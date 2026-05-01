"""
APScheduler background jobs.
- Daily AI auto-prediction job using heuristic team strengths
- Uses CampaignResponse.answers (JSON) — no Prediction table
"""
import uuid
import random
from datetime import datetime, UTC, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from .database import async_session
from .models import Match, MatchStatus, User, Campaign, CampaignResponse, CampaignQuestion, TournamentUserMapping

scheduler = AsyncIOScheduler()

# Heuristic team strength ratings. Higher = more likely to win.
TEAM_STRENGTHS = {
    "Chennai Super Kings": 5,
    "Mumbai Indians": 7,
    "Gujarat Titans": 8,
    "Rajasthan Royals": 9,
    "Royal Challengers Bengaluru": 10,
    "Lucknow Super Giants": 7,
    "Kolkata Knight Riders": 5,
    "Punjab Kings": 10,
    "Delhi Capitals": 7,
    "Sunrisers Hyderabad": 8,
}
DEFAULT_STRENGTH = 5


async def _get_team_stats(db, team_name: str) -> dict:
    """Returns avg powerplay score and recent POTM players for a team from CampaignMatchResult data."""
    # Pull recent completed match results from raw_result_json
    res = await db.execute(
        select(Match.raw_result_json, Match.team1, Match.team2).where(
            or_(Match.team1 == team_name, Match.team2 == team_name),
            Match.status == MatchStatus.completed,
            Match.raw_result_json != None,
        )
    )
    rows = res.all()

    scores = []
    potm_players = []

    for raw_json, t1, t2 in rows:
        if not raw_json:
            continue
        if t1 == team_name:
            pp = raw_json.get("team1_powerplay_score")
        else:
            pp = raw_json.get("team2_powerplay_score")
        if pp is not None:
            scores.append(int(pp))

        winner = raw_json.get("winner")
        potm = raw_json.get("player_of_the_match")
        if winner == team_name and potm:
            potm_players.append(potm)

    avg_pp = int(sum(scores) / len(scores)) if scores else random.randint(50, 70)
    return {"avg_pp": avg_pp, "potm": potm_players}


async def generate_ai_prediction(db, match: Match, ai_user: User):
    """
    Generates a heuristic AI prediction for a match and saves it as a CampaignResponse.
    All answers are stored in CampaignResponse.answers as a flat JSON dict.
    """
    t1_strength = TEAM_STRENGTHS.get(match.team1, DEFAULT_STRENGTH)
    t2_strength = TEAM_STRENGTHS.get(match.team2, DEFAULT_STRENGTH)
    t1_prob = t1_strength / (t1_strength + t2_strength)
    match_winner = match.team1 if random.random() < t1_prob else match.team2

    # Powerup logic — burn only on heavy favorites
    is_heavy_favorite = abs(t1_strength - t2_strength) >= 3
    use_powerup = False
    if is_heavy_favorite and random.random() < 0.3:
        # Check scoped powerups
        mapping_res = await db.execute(
            select(TournamentUserMapping).where(
                TournamentUserMapping.tournament_id == match.tournament_id,
                TournamentUserMapping.user_id == ai_user.id
            )
        )
        mapping = mapping_res.scalars().first()
        if not mapping:
            mapping = TournamentUserMapping(
                tournament_id=match.tournament_id,
                user_id=ai_user.id,
                base_powerups=10,
                powerups_used=0
            )
            db.add(mapping)
        
        # Count current used powerups in this tournament
        pu_res = await db.execute(
            select(CampaignResponse)
            .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
            .where(
                CampaignResponse.user_id == ai_user.id,
                CampaignResponse.use_powerup == True,
                Campaign.tournament_id == match.tournament_id
            )
        )
        used = len(pu_res.scalars().all())
        if used < mapping.base_powerups:
            use_powerup = True

    # Team stats for powerplay/POTM predictions
    team1_stats = await _get_team_stats(db, match.team1)
    team2_stats = await _get_team_stats(db, match.team2)
    team1_pp = team1_stats["avg_pp"] + random.randint(-5, 5)
    team2_pp = team2_stats["avg_pp"] + random.randint(-5, 5)
    winner_stats = team1_stats if match_winner == match.team1 else team2_stats
    players = winner_stats["potm"]
    potm = random.choice(players) if players else f"Star Player ({match_winner})"

    # Sixes/Fours predictions (from match 39+)
    match_number = 0
    try:
        match_number = int(match.id.split("-")[-1])
    except (ValueError, IndexError):
        pass
    more_sixes_team = (match.team1 if random.random() > 0.5 else match.team2) if match_number >= 39 else None
    more_fours_team = (match.team1 if random.random() > 0.5 else match.team2) if match_number >= 39 else None

    # Find the master campaign for this tournament
    cam_res = await db.execute(
        select(Campaign).options(selectinload(Campaign.questions))
        .where(Campaign.tournament_id == match.tournament_id, Campaign.is_master == True)
    )
    master_cam = cam_res.scalars().first()
    if not master_cam:
        return  # No campaign to predict against

    # Build answers dict {question_id: answer_value}
    answers = {}
    for q in master_cam.questions:
        text = (q.question_text or "").lower()
        opts = q.options or []
        qtype = q.question_type
        ans_val = None

        # Match winner
        if set(opts) == {match.team1, match.team2}:
            ans_val = match_winner
        # Powerplay (use key if available, fallback to text heuristic)
        elif qtype == "free_number" and "powerplay" in text:
            if match.team1.lower() in text or "team1" in text or "{{team1}}" in text:
                ans_val = team1_pp
            elif match.team2.lower() in text or "team2" in text or "{{team2}}" in text:
                ans_val = team2_pp
        # Player of the Match
        elif qtype == "free_text" and ("player" in text or "potm" in text or "man of" in text):
            ans_val = potm
        # Sixes / Fours
        elif qtype == "dropdown":
            if "six" in text:
                ans_val = more_sixes_team
            elif "four" in text:
                ans_val = more_fours_team

        if ans_val is not None:
            answers[q.id] = ans_val

    # Upsert CampaignResponse
    resp_res = await db.execute(
        select(CampaignResponse).where(
            CampaignResponse.user_id == ai_user.id,
            CampaignResponse.campaign_id == master_cam.id,
            CampaignResponse.match_id == match.id,
        )
    )
    response = resp_res.scalars().first()
    if response:
        response.answers = answers
        response.use_powerup = use_powerup
        response.is_auto_predicted = True
    else:
        response = CampaignResponse(
            id=str(uuid.uuid4()),
            user_id=ai_user.id,
            campaign_id=master_cam.id,
            match_id=match.id,
            answers=answers,
            use_powerup=use_powerup,
            is_auto_predicted=True,
        )
        db.add(response)

    # Deduct powerup if used
    if use_powerup:
        ai_user.base_powerups = max(0, ai_user.base_powerups - 1)


async def auto_predict_daily_job():
    """Daily cron job — runs at 00:00 UTC. Generates AI predictions for upcoming 24h matches."""
    print(f"[{datetime.now(UTC)}] Running auto_predict_daily_job...")
    async with async_session() as db:
        async with db.begin():
            ai_users_res = await db.execute(select(User).where(User.is_ai == True))
            ai_users = ai_users_res.scalars().all()

            if not ai_users:
                print("No AI users found. Skipping.")
                return

            now = datetime.now(UTC)
            tomorrow = now + timedelta(days=1)

            matches_res = await db.execute(
                select(Match).where(
                    Match.status == MatchStatus.upcoming,
                    Match.start_time >= now,
                    Match.start_time <= tomorrow,
                )
            )
            upcoming = matches_res.scalars().all()

            if not upcoming:
                print("No upcoming matches in the next 24 hours.")
                return

            for ai_user in ai_users:
                for match in upcoming:
                    await generate_ai_prediction(db, match, ai_user)

    print("Auto-predict completed.")


def start_scheduler():
    scheduler.add_job(auto_predict_daily_job, trigger='cron', hour=0, minute=0, timezone='UTC')
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown()
