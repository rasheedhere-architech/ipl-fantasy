import uuid
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_

from backend.models import (
    Match, Prediction, LeaderboardEntry, ScoringRule, User, 
    Campaign, CampaignResponse, LeaderboardCache, League, 
    LeagueUserMapping, LeagueCampaignMapping
)

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
    predictions_map = {p.user_id: p for p in p_result.scalars().all()}
    
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
            current_penalty = penalty_points
            if user.is_ai and match_number < 25:
                current_penalty = 0
            user_points[user.id] = current_penalty
            continue
            
        p = predictions_map[user.id]
        points = 0
        breakdown_rules = []
        
        # Powerup multiplier setup
        is_powerup = p.use_powerup == "Yes"
        multiplier = 2 if is_powerup else 1

        # RULE 1: Match Winner (+10 Correct, -5 Incorrect)
        if match.winner and p.match_winner:
            is_correct = str(p.match_winner).strip().lower() == str(match.winner).strip().lower()
            rule_points = 10 if is_correct else -5
            points += rule_points * multiplier
            breakdown_rules.append({
                "category": "Match Winner",
                "status": "correct" if is_correct else "incorrect",
                "points": rule_points * multiplier,
                "predicted": p.match_winner,
                "actual": match.winner
            })
        
        # RULE 2: Player of the Match (+25 Correct)
        if match.player_of_the_match and p.player_of_the_match:
            is_correct = str(p.player_of_the_match).strip().lower() == str(match.player_of_the_match).strip().lower()
            rule_points = 25 if is_correct else 0
            points += rule_points * multiplier
            breakdown_rules.append({
                "category": "Player of the Match",
                "status": "correct" if is_correct else "incorrect",
                "points": rule_points * multiplier,
                "predicted": p.player_of_the_match,
                "actual": match.player_of_the_match
            })

        # RULE 3: Team 1 Powerplay (Bingo 15, Range 5)
        if match.team1_powerplay_score is not None and p.team1_powerplay is not None:
            diff = abs(int(p.team1_powerplay) - int(match.team1_powerplay_score))
            rule_points = 0
            status = "miss"
            if diff == 0:
                rule_points = 15
                status = "bingo"
            elif diff <= 5:
                rule_points = 5
                status = "range"
            
            points += rule_points * multiplier
            breakdown_rules.append({
                "category": f"{match.team1} Powerplay",
                "status": status,
                "points": rule_points * multiplier,
                "predicted": p.team1_powerplay,
                "actual": match.team1_powerplay_score
            })

        # RULE 4: Team 2 Powerplay (Bingo 15, Range 5)
        if match.team2_powerplay_score is not None and p.team2_powerplay is not None:
            diff = abs(int(p.team2_powerplay) - int(match.team2_powerplay_score))
            rule_points = 0
            status = "miss"
            if diff == 0:
                rule_points = 15
                status = "bingo"
            elif diff <= 5:
                rule_points = 5
                status = "range"
            
            points += rule_points * multiplier
            breakdown_rules.append({
                "category": f"{match.team2} Powerplay",
                "status": status,
                "points": rule_points * multiplier,
                "predicted": p.team2_powerplay,
                "actual": match.team2_powerplay_score
            })

        # RULE 5: More Sixes (+5 Correct) - MULTIPLIED
        if match.more_sixes_team and p.more_sixes_team:
            actual_lower = str(match.more_sixes_team).strip().lower()
            predicted_lower = str(p.more_sixes_team).strip().lower()
            is_correct = (actual_lower == "tie") or (predicted_lower == actual_lower)
            rule_points = 5 if is_correct else 0
            points += rule_points * multiplier
            breakdown_rules.append({
                "category": "More Sixes",
                "status": "correct" if is_correct else "incorrect",
                "points": rule_points * multiplier,
                "predicted": p.more_sixes_team,
                "actual": match.more_sixes_team
            })

        # RULE 6: More Fours (+5 Correct) - NO POWERUP
        if match.more_fours_team and p.more_fours_team:
            actual_lower = str(match.more_fours_team).strip().lower()
            predicted_lower = str(p.more_fours_team).strip().lower()
            is_correct = (actual_lower == "tie") or (predicted_lower == actual_lower)
            rule_points = 5 if is_correct else 0
            points += rule_points # No multiplier
            breakdown_rules.append({
                "category": "More Fours",
                "status": "correct" if is_correct else "incorrect",
                "points": rule_points,
                "predicted": p.more_fours_team,
                "actual": match.more_fours_team
            })

        p.points_breakdown = {
            "rules": breakdown_rules,
            "powerup": {
                "used": is_powerup,
                "multiplier": multiplier,
            },
            "total": points
        }
        p.points_awarded = points
        user_points[user.id] = points

    # Update LeaderboardEntry
    for uid, pts in user_points.items():
        lb_res = await db.execute(
            select(LeaderboardEntry).where(LeaderboardEntry.match_id == match_id, LeaderboardEntry.user_id == uid)
        )
        lb_entry = lb_res.scalars().first()
        if lb_entry:
            lb_entry.points = pts
        else:
            lb_entry = LeaderboardEntry(id=str(uuid.uuid4()), user_id=uid, match_id=match_id, points=pts)
            db.add(lb_entry)
            
    await db.commit()
    await update_leaderboard_cache(db, match.tournament_id)


async def update_leaderboard_cache(db: AsyncSession, tournament_id: str):
    """
    Recalculates LeaderboardCache for all users in all leagues under a specific tournament.
    Points = (Global match points earned AFTER joining the league) + (League-specific campaign points)
    """
    leagues_res = await db.execute(select(League).where(League.tournament_id == tournament_id))
    leagues = leagues_res.scalars().all()
    
    for league in leagues:
        users_res = await db.execute(select(LeagueUserMapping).where(LeagueUserMapping.league_id == league.id))
        mappings = users_res.scalars().all()
        
        for mapping in mappings:
            uid = mapping.user_id
            joined_at = mapping.joined_at
            
            # 1. Match Points
            match_points_res = await db.execute(
                select(LeaderboardEntry.points)
                .join(Match, LeaderboardEntry.match_id == Match.id)
                .where(LeaderboardEntry.user_id == uid)
                .where(Match.tournament_id == tournament_id)
                .where(Match.toss_time >= joined_at)
            )
            global_points = sum(pts for (pts,) in match_points_res.all())
            
            # 2. Campaign Points (Including Global campaigns if mapped, and League specific ones)
            # Find all campaigns that belong to this league directly OR via LeagueCampaignMapping
            campaign_points_stmt = select(CampaignResponse.total_points).where(
                CampaignResponse.user_id == uid,
                CampaignResponse.campaign_id.in_(
                    select(Campaign.id).where(
                        or_(
                            Campaign.league_id == league.id,
                            Campaign.id.in_(select(LeagueCampaignMapping.campaign_id).where(LeagueCampaignMapping.league_id == league.id))
                        )
                    )
                )
            )
            campaign_points_res = await db.execute(campaign_points_stmt)
            campaign_points = sum(pts for (pts,) in campaign_points_res.all() if pts is not None)
            
            total_points = global_points + campaign_points
            
            # 3. Cache Entry
            cache_res = await db.execute(
                select(LeaderboardCache).where(LeaderboardCache.user_id == uid, LeaderboardCache.league_id == league.id)
            )
            cache_entry = cache_res.scalars().first()
            
            if cache_entry:
                cache_entry.total_points = total_points
            else:
                cache_entry = LeaderboardCache(
                    user_id=uid, league_id=league.id, tournament_id=tournament_id, total_points=total_points
                )
                db.add(cache_entry)
                
    await db.commit()
