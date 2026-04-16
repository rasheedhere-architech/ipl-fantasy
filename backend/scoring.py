import uuid
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.models import Match, Prediction, MatchV2, PredictionV2, LeaderboardEntry, ScoringRule, User

async def calculate_match_scores(match_id: str, db: AsyncSession):
    # Retrieve Match Results
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise ValueError("Match not found")

    # 1. Fetch all system users to identify non-participants
    u_result = await db.execute(select(User))
    all_users = u_result.scalars().all()

    # 2. Fetch all predictions for this specific match
    p_result = await db.execute(select(Prediction).where(Prediction.match_id == match_id))
    # Map by user_id for quick lookup
    predictions_map = {p.user_id: p for p in p_result.scalars().all()}
    
    user_points = {}
    
    for user in all_users:
        if user.id not in predictions_map:
            # RULE: Non-participation penalty
            user_points[user.id] = -5
            continue
            
        p = predictions_map[user.id]
        points = 0
        
        # RULE 1: Match Winner (+10 Correct, -5 Incorrect)
        if match.winner and p.match_winner:
            if str(p.match_winner).strip().lower() == str(match.winner).strip().lower():
                points += 10
            else:
                points -= 5
        
        # RULE 2: Player of the Match (+25 Correct)
        if match.player_of_the_match and p.player_of_the_match:
            if str(p.player_of_the_match).strip().lower() == str(match.player_of_the_match).strip().lower():
                points += 25

        # RULE 3: Team 1 Powerplay (Bingo 15, Range 5)
        if match.team1_powerplay_score is not None and p.team1_powerplay is not None:
            try:
                diff = abs(int(p.team1_powerplay) - int(match.team1_powerplay_score))
                if diff == 0:
                    points += 15
                elif diff <= 5:
                    points += 5
            except (ValueError, TypeError):
                pass

        # RULE 4: Team 2 Powerplay (Bingo 15, Range 5)
        if match.team2_powerplay_score is not None and p.team2_powerplay is not None:
            try:
                diff = abs(int(p.team2_powerplay) - int(match.team2_powerplay_score))
                if diff == 0:
                    points += 15
                elif diff <= 5:
                    points += 5
            except (ValueError, TypeError):
                pass

        # RULE 5: Powerup Multiplier (2x)
        if p.use_powerup == "Yes":
            points = points * 2
            
        # Save points back to the prediction record
        p.points_awarded = points
        user_points[user.id] = points

    # Update Leaderboard
    for uid, points in user_points.items():
        lb_res = await db.execute(
            select(LeaderboardEntry)
            .where(LeaderboardEntry.match_id == match_id)
            .where(LeaderboardEntry.user_id == uid)
        )
        lb_entry = lb_res.scalars().first()
        
        if lb_entry:
            lb_entry.points = points
        else:
            lb_entry = LeaderboardEntry(
                id=str(uuid.uuid4()),
                user_id=uid,
                match_id=match_id,
                points=points
            )
            db.add(lb_entry)
            
    await db.commit()
    print(f"Scoring complete for match {match_id}. User points updated with 2026 rules.")

async def calculate_match_scores_v2(match_id: str, db: AsyncSession):
    # Retrieve Match Results
    result = await db.execute(select(MatchV2).where(MatchV2.id == match_id))
    match = result.scalars().first()
    if not match:
        raise ValueError("Match not found")

    # 1. Fetch all system users to identify non-participants
    u_result = await db.execute(select(User))
    all_users = u_result.scalars().all()

    # 2. Fetch all predictions for this specific match
    p_result = await db.execute(select(PredictionV2).where(PredictionV2.match_id == match_id))
    # Map by user_id for quick lookup
    predictions_map = {p.user_id: p for p in p_result.scalars().all()}
    
    user_points = {}
    
    # Retrieve match questions and actual results
    questions = match.questions_json or []
    match_answers = match.answers_json or {}
    
    for user in all_users:
        if user.id not in predictions_map:
            # RULE: Non-participation penalty
            user_points[user.id] = -5
            continue
            
        p = predictions_map[user.id]
        points = 0
        user_answers = p.answers_json or {}
        
        for q in questions:
            q_id = q.get("id")
            q_type = q.get("type")
            q_points = q.get("points", 0)
            q_negative_points = q.get("negative_points", 0)
            
            correct_ans = match_answers.get(q_id)
            user_ans = user_answers.get(q_id)
            
            if correct_ans is None or user_ans is None:
                continue
                
            if q_type == "number":
                try:
                    if int(float(str(user_ans).strip())) == int(float(str(correct_ans).strip())):
                        points += q_points
                    else:
                        points += q_negative_points
                except (ValueError, TypeError):
                    points += q_negative_points
            elif q_type == "multi_answers":
                # Simple set comparison for multi answers
                if isinstance(correct_ans, list) and isinstance(user_ans, list):
                    if set(str(x).strip().lower() for x in correct_ans) == set(str(x).strip().lower() for x in user_ans):
                        points += q_points
                    else:
                        points += q_negative_points
            else:
                if str(user_ans).strip().lower() == str(correct_ans).strip().lower():
                    points += q_points
                else:
                    points += q_negative_points

        # Powerup Multiplier (2x)
        if p.use_powerup == "Yes":
            points = points * 2
            
        # Save points back to the prediction record
        p.points_awarded = points
        user_points[user.id] = points

    # Update Leaderboard (same entries used globally)
    for uid, points in user_points.items():
        lb_res = await db.execute(
            select(LeaderboardEntry)
            .where(LeaderboardEntry.match_id == match_id)
            .where(LeaderboardEntry.user_id == uid)
        )
        lb_entry = lb_res.scalars().first()
        
        if lb_entry:
            lb_entry.points = points
        else:
            lb_entry = LeaderboardEntry(
                id=str(uuid.uuid4()),
                user_id=uid,
                match_id=match_id,
                points=points
            )
            db.add(lb_entry)
            
    await db.commit()
    print(f"Scoring complete for MatchV2 {match_id}.")
