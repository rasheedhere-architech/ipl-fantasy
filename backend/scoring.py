"""
Core match scoring engine.
- Reads CampaignResponse.answers (JSON) per user
- Reads CampaignMatchResult.correct_answers as ground truth
- Writes points_breakdown back to CampaignResponse
- Writes LeaderboardEntry and updates LeaderboardCache
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.models import (
    Match, User, CampaignQuestion, Campaign, CampaignResponse,
    CampaignMatchResult, LeaderboardEntry, LeaderboardCache,
    League, LeagueUserMapping, TournamentUserMapping,
    SystemEventType,
)
from backend.utils.events import dispatch_event


def _apply_rules(answer_value, correct_answer, question_type: str, scoring_rules: dict, multiplier: int) -> tuple[int, str]:
    """
    Pure scoring function. Compares answer_value to correct_answer using scoring_rules.
    Returns (points, status).

    scoring_rules fields:
      exact_match_points  : points for exact/bingo match
      wrong_answer_points : points for wrong answer (can be negative)
      within_range_points : points for free_number within range_delta
      range_delta         : tolerance for free_number questions (default 5)
    """
    if answer_value is None or correct_answer is None:
        return 0, "skip"

    rules = scoring_rules or {}

    if question_type == "free_number":
        try:
            diff = abs(int(answer_value) - int(correct_answer))
        except (ValueError, TypeError):
            return 0, "skip"

        if diff == 0:
            pts = rules.get("exact_match_points", 0)
            return pts * multiplier, "bingo"
        elif diff <= rules.get("range_delta", 5):
            pts = rules.get("within_range_points", 0)
            return pts * multiplier, "range"
        else:
            pts = rules.get("wrong_answer_points", 0)
            # Negative penalties are never multiplied
            return pts if pts < 0 else pts, "miss"
    else:
        # String match (dropdown, free_text, toggle, multiple_choice)
        is_correct = str(answer_value).strip().lower() == str(correct_answer).strip().lower()
        if is_correct:
            pts = rules.get("exact_match_points", 0)
            return pts * multiplier, "correct"
        else:
            pts = rules.get("wrong_answer_points", 0)
            # Negative penalties are never multiplied
            return pts, "incorrect"


async def sync_match_results_to_campaign_questions(match_id: str, db: AsyncSession):
    """
    Syncs Match.raw_result_json into a CampaignMatchResult record for the master campaign.
    Falls back to legacy text-matching when result keys don't directly match question IDs.
    """
    match_res = await db.execute(select(Match).where(Match.id == match_id))
    match = match_res.scalars().first()
    if not match or not match.raw_result_json:
        return

    from sqlalchemy.orm import selectinload
    cam_res = await db.execute(
        select(Campaign).options(selectinload(Campaign.questions))
        .where(Campaign.tournament_id == match.tournament_id, Campaign.is_master == True)
    )
    master_cam = cam_res.scalars().first()
    if not master_cam:
        return

    t1, t2 = match.team1, match.team2
    res_data = match.raw_result_json

    winner = res_data.get("winner")
    pp1 = res_data.get("team1_powerplay_score") or res_data.get("scores", {}).get(t1)
    pp2 = res_data.get("team2_powerplay_score") or res_data.get("scores", {}).get(t2)
    potm = res_data.get("player_of_the_match") or res_data.get("potm")
    sixes = res_data.get("more_sixes_team")
    fours = res_data.get("more_fours_team")

    correct_answers_map = {}

    for q in master_cam.questions:
        # 1. Direct match by question ID in result payload
        if q.id in res_data:
            correct_answers_map[q.id] = res_data[q.id]
            continue

        # 2. Match by question key (slug) if defined
        if q.key and q.key in res_data:
            correct_answers_map[q.id] = res_data[q.key]
            continue

        # 3. Fallback heuristic by text/type
        opts = q.options or []
        qtype = q.question_type
        text = (q.question_text or "").lower()
        correct = None

        if set(opts) == {t1, t2} and winner:
            correct = winner
        elif qtype == "free_number" and "powerplay" in text:
            if t1.lower() in text or "team1" in text or "{{team1}}" in text:
                if pp1 is not None:
                    correct = str(pp1)
            elif t2.lower() in text or "team2" in text or "{{team2}}" in text:
                if pp2 is not None:
                    correct = str(pp2)
        elif qtype == "free_text" and ("player" in text or "potm" in text or "man of" in text):
            if potm:
                correct = potm
        elif qtype == "dropdown":
            if "six" in text and sixes:
                correct = sixes
            elif "four" in text and fours:
                correct = fours

        if correct is not None:
            correct_answers_map[q.id] = correct

    if correct_answers_map:
        cmr_res = await db.execute(
            select(CampaignMatchResult).where(
                CampaignMatchResult.match_id == match_id,
                CampaignMatchResult.campaign_id == master_cam.id
            )
        )
        cmr = cmr_res.scalars().first()
        if not cmr:
            cmr = CampaignMatchResult(
                id=str(uuid.uuid4()),
                campaign_id=master_cam.id,
                match_id=match_id,
                correct_answers=correct_answers_map
            )
            db.add(cmr)
        else:
            cmr.correct_answers = correct_answers_map

        await db.flush()


async def calculate_match_scores(match_id: str, db: AsyncSession):
    """
    Main scoring entry point for a completed match.
    1. Syncs raw_result_json → CampaignMatchResult
    2. Reads all CampaignResponses (JSON answers) for this match
    3. Scores each response against correct answers
    4. Writes points_breakdown back to CampaignResponse
    5. Upserts LeaderboardEntry and rebuilds LeaderboardCache
    """
    await sync_match_results_to_campaign_questions(match_id, db)

    # ── Match context ─────────────────────────────────────────────────────────
    match_res = await db.execute(select(Match).where(Match.id == match_id))
    match = match_res.scalars().first()
    if not match:
        raise ValueError(f"Match {match_id} not found")

    # ── Master campaign questions ─────────────────────────────────────────────
    q_res = await db.execute(
        select(CampaignQuestion, Campaign.id.label("campaign_id"))
        .join(Campaign, CampaignQuestion.campaign_id == Campaign.id)
        .where(Campaign.tournament_id == match.tournament_id, Campaign.is_master == True)
    )
    questions = q_res.all()
    if not questions:
        return  # No master campaign found

    master_campaign_id = questions[0].campaign_id
    question_map = {q.CampaignQuestion.id: q.CampaignQuestion for q in questions}

    # ── Ground truth ─────────────────────────────────────────────────────────
    cmr_res = await db.execute(
        select(CampaignMatchResult).where(
            CampaignMatchResult.match_id == match_id,
            CampaignMatchResult.campaign_id == master_campaign_id
        )
    )
    cmr = cmr_res.scalars().first()
    if not cmr or not cmr.correct_answers:
        return  # Results not yet reported

    correct_answers = cmr.correct_answers  # {question_id: answer_value}

    # ── All responses for this match ─────────────────────────────────────────
    resp_res = await db.execute(
        select(CampaignResponse).where(
            CampaignResponse.campaign_id == master_campaign_id,
            CampaignResponse.match_id == match_id,
        )
    )
    responses = resp_res.scalars().all()
    responses_by_user = {r.user_id: r for r in responses}

    # Scoped handicaps not needed for per-match scoring logic

    # ── Penalty config ────────────────────────────────────────────────────────
    match_number = 0
    try:
        match_number = int(match_id.split("-")[-1])
    except (ValueError, IndexError):
        pass
    penalty_points = -5 if match_number >= 12 else 0

    # ── Score each user ───────────────────────────────────────────────────────
    user_points: dict[str, int] = {}

    for user in all_users:
        response = responses_by_user.get(user.id)

        if not response:
            # No prediction — apply penalty (AI exempt before match 25)
            # Do NOT penalize if the user joined after the match started
            if user.created_at and match.start_time and user.created_at > match.start_time:
                current_penalty = 0
            else:
                current_penalty = penalty_points
                if user.is_ai and match_number < 25:
                    current_penalty = 0
            user_points[user.id] = current_penalty
            continue

        answers = response.answers or {}  # {question_id: answer_value}
        multiplier = 2 if response.use_powerup else 1

        total_points = 0
        breakdown_rules = []

        for q_id, q in question_map.items():
            answer_value = answers.get(q_id)
            correct_answer = correct_answers.get(q_id)

            # Respect allow_powerup flag (some questions like mid-tournament additions might exclude powerups)
            current_multiplier = multiplier if q.allow_powerup else 1

            pts, status = _apply_rules(
                answer_value=answer_value,
                correct_answer=correct_answer,
                question_type=q.question_type,
                scoring_rules=q.scoring_rules,
                multiplier=current_multiplier,
            )
            if status == "skip":
                continue

            total_points += pts
            breakdown_rules.append({
                "category": q.question_text,
                "key": q.key,
                "status": status,
                "points": pts,
                "predicted": answer_value,
                "actual": correct_answer,
                "was_boosted": current_multiplier > 1,
            })

        response.points_breakdown = {
            "rules": breakdown_rules,
            "powerup": {"used": response.use_powerup, "multiplier": multiplier},
            "total": total_points,
        }
        response.total_points = total_points
        user_points[user.id] = total_points

    # ── Upsert LeaderboardEntry (global, league_id=None) ─────────────────────
    for uid, pts in user_points.items():
        lb_res = await db.execute(
            select(LeaderboardEntry).where(
                LeaderboardEntry.match_id == match_id,
                LeaderboardEntry.user_id == uid,
                LeaderboardEntry.league_id == None,
            )
        )
        lb_entry = lb_res.scalars().first()
        breakdown = (responses_by_user.get(uid).points_breakdown
                     if uid in responses_by_user else None)
        if lb_entry:
            lb_entry.points = pts
            lb_entry.points_breakdown = breakdown
        else:
            db.add(LeaderboardEntry(
                id=str(uuid.uuid4()),
                user_id=uid,
                match_id=match_id,
                league_id=None,
                points=pts,
                points_breakdown=breakdown,
            ))

    await db.commit()
    await update_leaderboard_cache(db, match.tournament_id)
    
    # Log event
    await dispatch_event(
        db,
        event_type=SystemEventType.match_scored,
        match_id=match_id,
        message=f"Match {match.id} ({match.team1} vs {match.team2}) has been scored."
    )
    await db.commit()


async def update_leaderboard_cache(db: AsyncSession, tournament_id: str):
    """
    Rebuilds LeaderboardCache for all users across global and league scopes
    for a given tournament.
    """
    users_res = await db.execute(select(User).where(User.is_guest == False))
    all_users = users_res.scalars().all()
    
    # Pre-fetch tournament mappings
    mapping_res = await db.execute(
        select(TournamentUserMapping).where(TournamentUserMapping.tournament_id == tournament_id)
    )
    mapping_map = {m.user_id: m.base_points for m in mapping_res.scalars().all()}

    # ── Global cache (league_id=None) ────────────────────────────────────────
    for user in all_users:
        uid = user.id
        pts_res = await db.execute(
            select(LeaderboardEntry.points)
            .join(Match, LeaderboardEntry.match_id == Match.id)
            .where(
                LeaderboardEntry.user_id == uid,
                Match.tournament_id == tournament_id,
                LeaderboardEntry.league_id == None,
            )
        )
        # Legacy powerup decrement removed. Powerups are calculated dynamically or via mapping.
        base_points = mapping_map.get(uid, 0)
        total = sum(pts for (pts,) in pts_res.all()) + base_points

        cache_res = await db.execute(
            select(LeaderboardCache).where(
                LeaderboardCache.user_id == uid,
                LeaderboardCache.tournament_id == tournament_id,
                LeaderboardCache.league_id == None,
            )
        )
        cache = cache_res.scalars().first()
        if cache:
            cache.total_points = total
        else:
            db.add(LeaderboardCache(
                user_id=uid, tournament_id=tournament_id,
                league_id=None, total_points=total
            ))

    # ── Per-league caches ─────────────────────────────────────────────────────
    leagues_res = await db.execute(select(League).where(League.tournament_id == tournament_id))
    leagues = leagues_res.scalars().all()

    for league in leagues:
        mappings_res = await db.execute(
            select(LeagueUserMapping).where(LeagueUserMapping.league_id == league.id)
        )
        for mapping in mappings_res.scalars().all():
            uid = mapping.user_id
            joined_at = mapping.joined_at

            # Global match points earned AFTER joining
            global_pts_res = await db.execute(
                select(LeaderboardEntry.points)
                .join(Match, LeaderboardEntry.match_id == Match.id)
                .where(
                    LeaderboardEntry.user_id == uid,
                    Match.tournament_id == tournament_id,
                    LeaderboardEntry.league_id == None,
                    Match.start_time >= joined_at,
                )
            )
            global_points = sum(pts for (pts,) in global_pts_res.all())

            # League-specific campaign points
            league_pts_res = await db.execute(
                select(LeaderboardEntry.points).where(
                    LeaderboardEntry.user_id == uid,
                    LeaderboardEntry.league_id == league.id,
                )
            )
            league_points = sum(pts for (pts,) in league_pts_res.all() if pts is not None)

            base_points = mapping_map.get(uid, 0)
            total = global_points + league_points + base_points

            cache_res = await db.execute(
                select(LeaderboardCache).where(
                    LeaderboardCache.user_id == uid,
                    LeaderboardCache.tournament_id == tournament_id,
                    LeaderboardCache.league_id == league.id,
                )
            )
            cache = cache_res.scalars().first()
            if cache:
                cache.total_points = total
            else:
                db.add(LeaderboardCache(
                    user_id=uid,
                    tournament_id=tournament_id,
                    league_id=league.id,
                    total_points=total
                ))

    await db.commit()
