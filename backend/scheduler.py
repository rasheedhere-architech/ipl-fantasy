import asyncio
import uuid
from datetime import datetime, UTC, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, or_
from .database import async_session
from .models import Match, MatchStatus, Prediction, User
import random

scheduler = AsyncIOScheduler()

# A very basic "Team Strengths" tier list for option B heuristic.
# Higher weight means they are more likely to be picked.
# Let's say top teams get higher weights. If teams aren't here, they get a default weight of 5.
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
    "Sunrisers Hyderabad": 8
}
DEFAULT_STRENGTH = 5

async def generate_ai_prediction(db, match: Match, ai_user: User):
    """
    Generates a realistic prediction for an AI user using the Option B heuristic.
    """
    # 1. Determine favorite based on strengths
    t1_strength = TEAM_STRENGTHS.get(match.team1, DEFAULT_STRENGTH)
    t2_strength = TEAM_STRENGTHS.get(match.team2, DEFAULT_STRENGTH)
    
    # Calculate probability of t1 winning
    total_strength = t1_strength + t2_strength
    t1_prob = t1_strength / total_strength if total_strength > 0 else 0.5
    
    # Pick winner
    match_winner = match.team1 if random.random() < t1_prob else match.team2
    
    # 2. Powerup usage logic
    # Heavy favorite definition: difference in strength >= 3
    is_heavy_favorite = abs(t1_strength - t2_strength) >= 3
    use_powerup = "No"
    
    if is_heavy_favorite and ai_user.base_powerups > 0:
        # Use powerup if it's a heavy favorite (maybe 30% chance if available to not burn through them instantly)
        if random.random() < 0.3:
            use_powerup = "Yes"
    
    # 3. Predict powerplay and POTM through DB stats like the AI Auto Predict feature
    async def get_team_stats(team_name: str) -> dict:
        stmt = select(Match.team1, Match.team2, Match.team1_powerplay_score, Match.team2_powerplay_score, Match.player_of_the_match, Match.winner).where(
            or_(Match.team1 == team_name, Match.team2 == team_name)
        )
        res = await db.execute(stmt)
        matches = res.all()

        scores = []
        potm_players = []

        for m in matches:
            if m.team1 == team_name and m.team1_powerplay_score is not None:
                scores.append(m.team1_powerplay_score)
            elif m.team2 == team_name and m.team2_powerplay_score is not None:
                scores.append(m.team2_powerplay_score)

            if m.winner == team_name and m.player_of_the_match:
                potm_players.append(m.player_of_the_match)

        avg_pp = int(sum(scores) / len(scores)) if scores else random.randint(50, 70)
        potm_list = [p for p in potm_players if p and p.strip()]

        stats = {"avg_pp": avg_pp, "potm": potm_list}
        return stats

    team1_stats = await get_team_stats(match.team1)
    team2_stats = await get_team_stats(match.team2)

    team1_pp = team1_stats["avg_pp"] + random.randint(-5, 5)
    team2_pp = team2_stats["avg_pp"] + random.randint(-5, 5)

    winner_stats = team1_stats if match_winner == match.team1 else team2_stats
    players = winner_stats["potm"]
    potm = random.choice(players) if players else f"Star Player ({match_winner})"
    
    # 4. More Sixes and More Fours (Randomly choose for matches >= 39)
    match_number = 0
    if "-" in match.id:
        try:
            match_number = int(match.id.split("-")[-1])
        except ValueError:
            pass
            
    more_sixes_team = None
    more_fours_team = None
    if match_number >= 39:
        more_sixes_team = match.team1 if random.random() > 0.5 else match.team2
        more_fours_team = match.team1 if random.random() > 0.5 else match.team2
    
    # 5. Save to CampaignResponse & CampaignAnswer
    from .models import Campaign, CampaignResponse, CampaignAnswer, CampaignQuestion
    from sqlalchemy.orm import selectinload

    # Find master campaign for this match
    cam_res = await db.execute(
        select(Campaign).options(selectinload(Campaign.questions))
        .where(Campaign.match_id == match.id, Campaign.is_master == True)
    )
    master_cam = cam_res.scalars().first()
    if not master_cam:
        return # No campaign to predict for

    # Create or get response
    resp_res = await db.execute(
        select(CampaignResponse).where(CampaignResponse.user_id == ai_user.id, CampaignResponse.campaign_id == master_cam.id)
    )
    response = resp_res.scalars().first()
    if not response:
        response = CampaignResponse(
            id=str(uuid.uuid4()),
            user_id=ai_user.id,
            campaign_id=master_cam.id,
            match_id=match.id
        )
        db.add(response)

    # Predict answers for each question
    for q in master_cam.questions:
        text = (q.question_text or "").lower()
        opts = q.options or []
        qtype = q.question_type
        ans_val = None

        # Match Winner
        if set(opts) == {match.team1, match.team2}:
            ans_val = match_winner
        # Powerplay
        elif qtype == "free_number" and "powerplay" in text:
            if match.team1.lower() in text or "team1" in text or "{{team1}}" in text:
                ans_val = team1_pp
            elif match.team2.lower() in text or "team2" in text or "{{team2}}" in text:
                ans_val = team2_pp
        # Player of the Match
        elif qtype == "free_text" and ("player" in text or "potm" in text):
            ans_val = potm
        # Sixes/Fours
        elif qtype == "dropdown":
            if "six" in text: ans_val = more_sixes_team
            elif "four" in text: ans_val = more_fours_team

        if ans_val is not None:
            # Check for existing answer
            ans_res = await db.execute(
                select(CampaignAnswer).where(CampaignAnswer.response_id == response.id, CampaignAnswer.question_id == q.id)
            )
            existing_ans = ans_res.scalars().first()
            if existing_ans:
                existing_ans.answer_value = ans_val
            else:
                db.add(CampaignAnswer(
                    id=str(uuid.uuid4()),
                    response_id=response.id,
                    question_id=q.id,
                    answer_value=ans_val
                ))

    # Also create/update the legacy Prediction entry (for points summary)
    pred_res = await db.execute(select(Prediction).where(Prediction.user_id == ai_user.id, Prediction.match_id == match.id))
    prediction = pred_res.scalars().first()
    if not prediction:
        prediction = Prediction(
            id=f"ai_{match.id}_{ai_user.id[:8]}", # Unique ID
            user_id=ai_user.id,
            match_id=match.id,
            use_powerup=use_powerup,
            is_auto_predicted=True
        )
        db.add(prediction)
    else:
        prediction.use_powerup = use_powerup
        prediction.is_auto_predicted = True

    # Deduct powerup if used
    if use_powerup == "Yes":
        ai_user.base_powerups -= 1
        db.add(ai_user)

async def auto_predict_daily_job():
    """Daily cron job run at 12:00 AM UTC."""
    print(f"[{datetime.now(UTC)}] Running auto_predict_daily_job for AI user...")
    async with async_session() as db:
        async with db.begin():
            # Find all AI users
            ai_users_result = await db.execute(select(User).where(User.is_ai == True))
            ai_users = ai_users_result.scalars().all()
            
            if not ai_users:
                print("No AI users found. Skipping auto-predict.")
                return
                
            # Get matches for today (next 24 hours). 
            # Or just matches that are "upcoming" and start_time is within the next 24 hours.
            now = datetime.now(UTC)
            tomorrow = now + timedelta(days=1)
            
            matches_result = await db.execute(
                select(Match).where(
                    Match.status == MatchStatus.upcoming,
                    Match.start_time >= now,
                    Match.start_time <= tomorrow
                )
            )
            upcoming_matches = matches_result.scalars().all()
            
            if not upcoming_matches:
                print("No upcoming matches in the next 24 hours for the AI.")
                return
                
            for ai_user in ai_users:
                for match in upcoming_matches:
                    await generate_ai_prediction(db, match, ai_user)
            
            # Commit happens automatically due to async with db.begin()
    print("Auto-predict completed successfully.")

def start_scheduler():
    # Run the job every day at 00:00 UTC
    scheduler.add_job(auto_predict_daily_job, trigger='cron', hour=0, minute=0, timezone='UTC')
    scheduler.start()

def stop_scheduler():
    scheduler.shutdown()
