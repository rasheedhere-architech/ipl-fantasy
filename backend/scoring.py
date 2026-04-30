import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from backend.models import (
    Match, Prediction, LeaderboardEntry, ScoringRule, User,
    Campaign, CampaignResponse, CampaignAnswer, CampaignQuestion,
    LeaderboardCache, League, LeagueUserMapping, LeagueCampaignMapping
)


def _apply_rules(answer_value, correct_answer, question_type: str, scoring_rules: dict, multiplier: int) -> tuple[int, str]:
    """
    Pure scoring function: compares answer_value to correct_answer using scoring_rules.
    Returns (points, status).

    scoring_rules fields used:
      - exact_match_points   : points for exact/bingo match
      - wrong_answer_points  : points for wrong answer (can be negative)
      - within_range_points  : points for being within range_delta (free_number only)
      - range_delta          : tolerance for free_number questions (default 5)
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
            return pts * multiplier if pts < 0 else pts, "miss"
    else:
        # String match (dropdown, free_text, toggle, multiple_choice)
        is_correct = str(answer_value).strip().lower() == str(correct_answer).strip().lower()
        if is_correct:
            pts = rules.get("exact_match_points", 0)
            return pts * multiplier, "correct"
        else:
            pts = rules.get("wrong_answer_points", 0)
            # Negative penalty is not multiplied for fairness (keeps original behaviour)
            return pts, "incorrect"


async def sync_match_results_to_campaign_questions(match_id: str, db: AsyncSession):
    """
    Synchronizes the Match model's raw_result_json to the CampaignMatchResult record.
    This ensures that correct answers are match-specific even if questions are shared.
    """
    from backend.models import Match, Campaign, CampaignQuestion, CampaignMatchResult
    from sqlalchemy.orm import selectinload

    # Fetch match
    match_res = await db.execute(select(Match).where(Match.id == match_id))
    match = match_res.scalars().first()
    if not match or not match.raw_result_json:
        return

    # Find master campaign for this tournament
    cam_res = await db.execute(
        select(Campaign).options(selectinload(Campaign.questions))
        .where(Campaign.tournament_id == match.tournament_id, Campaign.is_master == True)
    )
    master_cam = cam_res.scalars().first()
    if not master_cam:
        return

    t1, t2 = match.team1, match.team2
    res_data = match.raw_result_json
    
    # Extract results from raw_result_json (handle legacy or standard formats)
    winner = res_data.get("winner")
    pp1 = res_data.get("team1_powerplay_score") or res_data.get("scores", {}).get(t1)
    pp2 = res_data.get("team2_powerplay_score") or res_data.get("scores", {}).get(t2)
    potm = res_data.get("player_of_the_match") or res_data.get("potm")
    sixes = res_data.get("more_sixes_team")
    fours = res_data.get("more_fours_team")

    correct_answers_map = {}

    for q in master_cam.questions:
        # Check for direct mapping first (modern dynamic mapping)
        if q.id in res_data:
            correct_answers_map[q.id] = res_data[q.id]
            continue

        # Fallback to legacy identification logic
        opts = q.options or []
        qtype = q.question_type
        text = (q.question_text or "").lower()
        correct = None

        # Match Winner
        if set(opts) == {t1, t2} and winner:
            correct = winner
        # Powerplay
        elif qtype == "free_number" and "powerplay" in text:
            if t1.lower() in text or "team1" in text or "{{team1}}" in text:
                if pp1 is not None: correct = str(pp1)
            elif t2.lower() in text or "team2" in text or "{{team2}}" in text:
                if pp2 is not None: correct = str(pp2)
        # Player of the Match
        elif qtype == "free_text" and ("player" in text or "potm" in text or "man of" in text):
            if potm: correct = potm
        # Sixes / Fours
        elif qtype == "dropdown":
            if "six" in text and sixes: correct = sixes
            elif "four" in text and fours: correct = fours

        if correct is not None:
            correct_answers_map[q.id] = correct

    if correct_answers_map:
        # Save or update CampaignMatchResult
        cmr_res = await db.execute(
            select(CampaignMatchResult).where(CampaignMatchResult.match_id == match_id, CampaignMatchResult.campaign_id == master_cam.id)
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
    Main entry point for scoring a match. 
    1. Syncs match results to master questions.
    2. Calculates points for all participants based on their answers.
    3. Updates predictions and leaderboard entries.
    """
    # ── Sync Results ──────────────────────────────────────────────────────────
    await sync_match_results_to_campaign_questions(match_id, db)

    # ── Fetch Context ─────────────────────────────────────────────────────────
    # Get all participants
    users_res = await db.execute(select(User).where(User.is_guest == False))
    all_users = users_res.scalars().all()
    
    # Get match info
    match_res = await db.execute(select(Match).where(Match.id == match_id))
    match = match_res.scalars().first()
    if not match:
        raise ValueError("Match not found")

    # ── Fetch master questions & results ──────────────────────────────────────
    from backend.models import CampaignMatchResult
    q_res = await db.execute(
        select(CampaignQuestion, Campaign.id.label("campaign_id"))
        .join(Campaign, CampaignQuestion.campaign_id == Campaign.id)
        .where(Campaign.tournament_id == match.tournament_id, Campaign.is_master == True)
    )
    questions = q_res.all()
    if not questions:
        return # No master campaign for this match's tournament

    master_campaign_id = questions[0].campaign_id

    # Fetch ground truth for this match
    cmr_res = await db.execute(
        select(CampaignMatchResult).where(
            CampaignMatchResult.match_id == match_id,
            CampaignMatchResult.campaign_id == master_campaign_id
        )
    )
    cmr = cmr_res.scalars().first()
    if not cmr or not cmr.correct_answers:
        return # No results reported yet

    correct_answers = cmr.correct_answers

    # ── Fetch all answers for these questions ────────────────────────────────
    ans_res = await db.execute(
        select(CampaignAnswer, CampaignResponse.user_id)
        .join(CampaignResponse, CampaignAnswer.response_id == CampaignResponse.id)
        .where(
            CampaignResponse.match_id == match_id,
            CampaignAnswer.question_id.in_([q.CampaignQuestion.id for q in questions])
        )
    )
    answers_list = ans_res.all()

    # Group answers by user
    user_answers = {}
    for ans_row, user_id in answers_list:
        if user_id not in user_answers:
            user_answers[user_id] = []
        
        q_obj = next(q.CampaignQuestion for q in questions if q.CampaignQuestion.id == ans_row.question_id)
        user_answers[user_id].append({
            "answer_value": ans_row.answer_value,
            "correct_answer": correct_answers.get(ans_row.question_id),
            "q_type": q_obj.question_type,
            "scoring_rules": q_obj.scoring_rules,
            "q_text": q_obj.question_text,
            "ans_obj": ans_row
        })

    # ── Fetch all predictions (for use_powerup + penalty tracking) ───────────
    p_result = await db.execute(select(Prediction).where(Prediction.match_id == match_id))
    predictions_map = {p.user_id: p for p in p_result.scalars().all()}

    # ── Penalty config ────────────────────────────────────────────────────────
    match_number = 0
    if "-" in match_id:
        try:
            match_number = int(match_id.split("-")[-1])
        except ValueError:
            pass
    penalty_points = -5 if match_number >= 12 else 0

    # ── Score each user ───────────────────────────────────────────────────────
    user_points: dict[str, int] = {}

    for user in all_users:
        if user.id not in predictions_map:
            # No prediction → apply penalty (AI exempt before match 25)
            current_penalty = penalty_points
            if user.is_ai and match_number < 25:
                current_penalty = 0
            user_points[user.id] = current_penalty
            continue

        pred = predictions_map[user.id]
        is_powerup = pred.use_powerup == "Yes"
        multiplier = 2 if is_powerup else 1

        total_points = 0
        breakdown_rules = []

        for ans in user_answers.get(user.id, []):
            pts, status = _apply_rules(
                answer_value=ans["answer_value"],
                correct_answer=ans["correct_answer"],
                question_type=ans["q_type"],
                scoring_rules=ans["scoring_rules"],
                multiplier=multiplier,
            )
            if status == "skip":
                continue

            total_points += pts
            breakdown_rules.append({
                "category": ans["q_text"],
                "status": status,
                "points": pts,
                "predicted": ans["answer_value"],
                "actual": ans["correct_answer"],
            })

        pred.points_breakdown = {
            "rules": breakdown_rules,
            "powerup": {"used": is_powerup, "multiplier": multiplier},
            "total": total_points,
        }
        pred.points_awarded = total_points
        user_points[user.id] = total_points

    # ── Update LeaderboardEntry ───────────────────────────────────────────────
    for uid, pts in user_points.items():
        lb_res = await db.execute(
            select(LeaderboardEntry).where(
                LeaderboardEntry.match_id == match_id,
                LeaderboardEntry.user_id == uid
            )
        )
        lb_entry = lb_res.scalars().first()
        if lb_entry:
            lb_entry.points = pts
            lb_entry.league_id = None
        else:
            db.add(LeaderboardEntry(
                id=str(uuid.uuid4()), 
                user_id=uid, 
                match_id=match_id, 
                league_id=None,
                points=pts
            ))

    await db.commit()
    await update_leaderboard_cache(db, match.tournament_id)


async def update_leaderboard_cache(db: AsyncSession, tournament_id: str):
    """
    Recalculates LeaderboardCache for all users in all leagues under a specific tournament,
    plus a 'global' entry for the tournament itself.
    """
    from backend.models import Tournament, User
    
    # Get all users participating in this tournament (any league or master)
    users_res = await db.execute(select(User).where(User.is_guest == False))
    all_users = users_res.scalars().all()

    # 1. Update Global Cache (league_id=None) for the tournament
    for user in all_users:
        uid = user.id
        match_points_res = await db.execute(
            select(LeaderboardEntry.points)
            .join(Match, LeaderboardEntry.match_id == Match.id)
            .where(LeaderboardEntry.user_id == uid)
            .where(Match.tournament_id == tournament_id)
            .where(LeaderboardEntry.league_id == None)
        )
        total_global_points = sum(pts for (pts,) in match_points_res.all())

        # Upsert global cache
        cache_res = await db.execute(
            select(LeaderboardCache).where(
                LeaderboardCache.user_id == uid,
                LeaderboardCache.tournament_id == tournament_id,
                LeaderboardCache.league_id == None
            )
        )
        cache_entry = cache_res.scalars().first()
        if cache_entry:
            cache_entry.total_points = total_global_points
        else:
            db.add(LeaderboardCache(
                user_id=uid, tournament_id=tournament_id,
                league_id=None, total_points=total_global_points
            ))

    # 2. Update Specific League Caches
    leagues_res = await db.execute(select(League).where(League.tournament_id == tournament_id))
    leagues = leagues_res.scalars().all()

    for league in leagues:
        users_mapping_res = await db.execute(select(LeagueUserMapping).where(LeagueUserMapping.league_id == league.id))
        mappings = users_mapping_res.scalars().all()

        for mapping in mappings:
            uid = mapping.user_id
            joined_at = mapping.joined_at

            # Global match points earned AFTER joining the league
            match_points_res = await db.execute(
                select(LeaderboardEntry.points)
                .join(Match, LeaderboardEntry.match_id == Match.id)
                .where(LeaderboardEntry.user_id == uid)
                .where(Match.tournament_id == tournament_id)
                .where(LeaderboardEntry.league_id == None)
                .where(Match.start_time >= joined_at)
            )
            global_points = sum(pts for (pts,) in match_points_res.all())

            # League-specific campaign points (from LeaderboardEntry to include non-participation penalties)
            campaign_points_stmt = select(LeaderboardEntry.points).where(
                LeaderboardEntry.user_id == uid,
                LeaderboardEntry.league_id == league.id
            )
            campaign_points_res = await db.execute(campaign_points_stmt)
            campaign_points = sum(pts for (pts,) in campaign_points_res.all() if pts is not None)

            total_points = global_points + campaign_points

            # Upsert league cache
            cache_res = await db.execute(
                select(LeaderboardCache).where(
                    LeaderboardCache.user_id == uid,
                    LeaderboardCache.league_id == league.id
                )
            )
            cache_entry = cache_res.scalars().first()
            if cache_entry:
                cache_entry.total_points = total_points
            else:
                db.add(LeaderboardCache(
                    user_id=uid, league_id=league.id,
                    tournament_id=tournament_id, total_points=total_points
                ))

    await db.commit()
