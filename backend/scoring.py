import uuid
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.models import Match, Prediction, LeaderboardEntry, ScoringRule, User

async def calculate_match_scores(match_id: str, db: AsyncSession):
    # Retrieve Match Results
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise ValueError("Match not found")

    # 1. Fetch only users who are not guests (includes AI and Experts)
    u_result = await db.execute(select(User).where(User.is_guest == False))
    all_users = u_result.scalars().all()

    # 2. Fetch all predictions for this specific match
    p_result = await db.execute(select(Prediction).where(Prediction.match_id == match_id))
    # Map by user_id for quick lookup
    predictions_map = {p.user_id: p for p in p_result.scalars().all()}
    
    # Check if penalty applies (only from Match 12 onwards)
    # match_id format is typically "ipl-2026-X"
    match_number = 0
    if "-" in match_id:
        parts = match_id.split("-")
        try:
            match_number = int(parts[-1])
        except ValueError:
            pass
            
    penalty_points = -5 if match_number >= 12 else 0
    
    user_points = {}
    
    for user in all_users:
        if user.id not in predictions_map:
            # RULE: Non-participation penalty
            user_points[user.id] = penalty_points
            continue
            
        p = predictions_map[user.id]
        points = 0
        breakdown_rules = []
        
        # RULE 1: Match Winner (+10 Correct, -5 Incorrect)
        if match.winner and p.match_winner:
            is_correct = str(p.match_winner).strip().lower() == str(match.winner).strip().lower()
            rule_points = 10 if is_correct else -5
            points += rule_points
            breakdown_rules.append({
                "category": "Match Winner",
                "status": "correct" if is_correct else "incorrect",
                "points": rule_points,
                "predicted": p.match_winner,
                "actual": match.winner
            })
        
        # RULE 2: Player of the Match (+25 Correct)
        if match.player_of_the_match and p.player_of_the_match:
            is_correct = str(p.player_of_the_match).strip().lower() == str(match.player_of_the_match).strip().lower()
            if is_correct:
                points += 25
                breakdown_rules.append({
                    "category": "Player of the Match",
                    "status": "correct",
                    "points": 25,
                    "predicted": p.player_of_the_match,
                    "actual": match.player_of_the_match
                })
            else:
                breakdown_rules.append({
                    "category": "Player of the Match",
                    "status": "incorrect",
                    "points": 0,
                    "predicted": p.player_of_the_match,
                    "actual": match.player_of_the_match
                })

        # RULE 3: Team 1 Powerplay (Bingo 15, Range 5)
        if match.team1_powerplay_score is not None and p.team1_powerplay is not None:
            try:
                diff = abs(int(p.team1_powerplay) - int(match.team1_powerplay_score))
                rule_points = 0
                status = "miss"
                if diff == 0:
                    rule_points = 15
                    status = "bingo"
                elif diff <= 5:
                    rule_points = 5
                    status = "range"
                
                points += rule_points
                breakdown_rules.append({
                    "category": f"{match.team1} Powerplay",
                    "status": status,
                    "points": rule_points,
                    "predicted": p.team1_powerplay,
                    "actual": match.team1_powerplay_score
                })
            except (ValueError, TypeError):
                pass

        # RULE 4: Team 2 Powerplay (Bingo 15, Range 5)
        if match.team2_powerplay_score is not None and p.team2_powerplay is not None:
            try:
                diff = abs(int(p.team2_powerplay) - int(match.team2_powerplay_score))
                rule_points = 0
                status = "miss"
                if diff == 0:
                    rule_points = 15
                    status = "bingo"
                elif diff <= 5:
                    rule_points = 5
                    status = "range"
                
                points += rule_points
                breakdown_rules.append({
                    "category": f"{match.team2} Powerplay",
                    "status": status,
                    "points": rule_points,
                    "predicted": p.team2_powerplay,
                    "actual": match.team2_powerplay_score
                })
            except (ValueError, TypeError):
                pass

        # RULE 5: Powerup Multiplier (2x)
        points_before_powerup = points
        if p.use_powerup == "Yes":
            points = points * 2
            
        # Build final breakdown
        p.points_breakdown = {
            "rules": breakdown_rules,
            "powerup": {
                "used": p.use_powerup == "Yes",
                "multiplier": 2 if p.use_powerup == "Yes" else 1,
                "points_before": points_before_powerup,
                "points_after": points
            },
            "total": points
        }
            
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
