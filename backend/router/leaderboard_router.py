from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, case

from backend.database import get_db
from backend.models import User, LeaderboardEntry, AllowlistedEmail
from backend.utils.cache import backend_cache

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

@router.get("")
async def get_global_leaderboard(db: AsyncSession = Depends(get_db)):
    cache_key = "global_leaderboard"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    # Group by user summing all points
    result = await db.execute(
        select(
            User.id,
            User.name,
            User.avatar_url,
            (func.coalesce(func.sum(LeaderboardEntry.points), 0) + User.base_points).label("total_points"),
            func.count(LeaderboardEntry.match_id).label("matches_played"),
            User.base_points,
            User.base_powerups
        )
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
        .outerjoin(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .group_by(User.id, User.base_points, User.base_powerups)
        .order_by((func.coalesce(func.sum(LeaderboardEntry.points), 0) + User.base_points).desc())
    )
    
    users_data = result.all()
    
    from backend.models import Prediction
    p_res = await db.execute(
        select(Prediction.user_id, func.count(Prediction.id))
        .where(Prediction.use_powerup == "Yes")
        .group_by(Prediction.user_id)
    )
    powerups_used_map = {row[0]: row[1] for row in p_res.all()}
    
    entries = []
    for rank, (uid, name, avatar, points, played, bp, total_powerups) in enumerate(users_data, start=1):
        # Fetch detailed per-match progression for this user
        from backend.models import Match
        prog_res = await db.execute(
            select(LeaderboardEntry.points, Match.team1, Match.team2, Match.id)
            .join(Match, LeaderboardEntry.match_id == Match.id)
            .where(LeaderboardEntry.user_id == uid)
            .order_by(Match.toss_time.asc())
        )
        detailed_progression = []
        for p, t1, t2, mid in prog_res.all():
            m_no = mid.split("-")[2] if "-" in mid else mid
            detailed_progression.append({
                "match_number": m_no,
                "teams": f"{t1} vs {t2}",
                "points": p
            })
        progression = detailed_progression # Now an array of objects!
        
        used = powerups_used_map.get(uid, 0)
        remaining_powerups = max(0, (total_powerups or 10) - used)
        
        entries.append({
            "rank": rank,
            "username": name,
            "avatar_url": avatar,
            "total_points": points,
            "matches_played": played,
            "base_points": bp,
            "remaining_powerups": remaining_powerups,
            "progression": progression, # Array of [25, 10, -20...]
            "accuracy_pct": 0
        })
    
    backend_cache.set(cache_key, entries)
    return entries

@router.get("/match/{match_id}")
async def get_match_leaderboard(match_id: str, db: AsyncSession = Depends(get_db)):
    cache_key = f"match_leaderboard_{match_id}"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(User.id, User.name, User.avatar_url, LeaderboardEntry.points)
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .where(LeaderboardEntry.match_id == match_id)
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
        .order_by(LeaderboardEntry.points.desc())
    )
    
    entries = []
    for rank, (uid, name, avatar, points) in enumerate(result.all(), start=1):
        entries.append({
            "rank": rank,
            "username": name,
            "avatar_url": avatar,
            "match_points": points
        })
    
    backend_cache.set(cache_key, entries)
    return entries

@router.get("/match-podiums")
async def get_match_podiums(db: AsyncSession = Depends(get_db)):
    cache_key = "match_podiums"
    # cached = backend_cache.get(cache_key)
    # if cached: return cached

    from backend.models import Match
    matches_res = await db.execute(
        select(Match)
        .where(Match.status == "completed")
        .order_by(Match.toss_time.desc())
    )
    matches = matches_res.scalars().all()
    
    podiums = []
    for m in matches:
        lb_res = await db.execute(
            select(User.name, User.avatar_url, LeaderboardEntry.points)
            .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
            .where(LeaderboardEntry.match_id == m.id)
            .order_by(LeaderboardEntry.points.desc())
        )
        
        all_players = lb_res.all()
        top_players = []
        current_rank = 0
        last_points = None
        
        for i, (name, avatar, pts) in enumerate(all_players):
            if pts != last_points:
                current_rank = i + 1
            
            if current_rank > 3:
                break
                
            top_players.append({
                "username": name,
                "avatar_url": avatar,
                "points": pts,
                "rank": current_rank
            })
            last_points = pts
        
        mid = m.id
        m_no = mid.split("-")[2] if "-" in mid else mid
        podiums.append({
            "match_id": m.id,
            "match_number": m_no,
            "match_name": f"{m.team1} vs {m.team2}",
            "match_date": m.toss_time,
            "top_players": top_players
        })
    
    backend_cache.set(cache_key, podiums)
    return podiums

@router.get("/analysis")
async def get_analysis_data(db: AsyncSession = Depends(get_db)):
    cache_key = "analysis"
    cached = backend_cache.get(cache_key)
    if cached: 
        return cached

    from datetime import UTC, datetime, timedelta
    now = datetime.now(UTC)
    last_week = now - timedelta(days=7)
    
    from backend.models import Match
    
    # 1. Weekly Performance
    weekly_res = await db.execute(
        select(
            User.id,
            User.name,
            User.avatar_url,
            func.sum(LeaderboardEntry.points).label("weekly_points"),
            func.count(LeaderboardEntry.match_id).label("matches_played")
        )
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.toss_time >= last_week)
        .where(User.is_guest == False)
        .group_by(User.id)
        .order_by(func.sum(LeaderboardEntry.points).desc())
    )
    
    weekly_stats = []
    for uid, name, avatar, pts, count in weekly_res.all():
        weekly_stats.append({
            "username": name,
            "avatar_url": avatar,
            "points": pts,
            "matches": count
        })

    # 3. Powerups Analytics
    from backend.models import Prediction
    powerup_usage_res = await db.execute(
        select(
            User.name,
            User.avatar_url,
            User.base_powerups,
            Match.team1,
            Match.team2,
            Match.id.label("match_id"),
            Match.toss_time,
            Prediction.points_awarded,
            Match.status
        )
        .join(Prediction, User.id == Prediction.user_id)
        .join(Match, Prediction.match_id == Match.id)
        .where(Prediction.use_powerup == "Yes")
        .where(User.is_guest == False)
        .order_by(User.name, Match.toss_time.desc())
    )
    
    powerup_stats_map = {}
    for name, avatar, base, t1, t2, mid, toss_time, points, status in powerup_usage_res.all():
        if name not in powerup_stats_map:
            powerup_stats_map[name] = {
                "username": name,
                "avatar_url": avatar,
                "base_powerups": base or 10,
                "used_matches": [],
                "total_powerup_points": 0,
                "avg_points_per_powerup": 0
            }
        
        m_no = mid.split("-")[2] if "-" in mid else mid
        powerup_stats_map[name]["used_matches"].append({
            "match_id": mid,
            "match_number": m_no,
            "teams": f"{t1} vs {t2}",
            "date": toss_time,
            "points": points or 0,
            "match_status": status
        })
        
        if status == "completed":
            powerup_stats_map[name]["total_powerup_points"] += (points or 0)

    for stats in powerup_stats_map.values():
        completed_count = len([m for m in stats["used_matches"] if m["match_status"] == "completed"])
        if completed_count > 0:
            stats["avg_points_per_powerup"] = round(stats["total_powerup_points"] / completed_count, 1)
    
    # Include all relevant users even if they haven't used powerups
    all_users_res = await db.execute(
        select(User.name, User.avatar_url, User.base_powerups)
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
    )
    for name, avatar, base in all_users_res.all():
        if name not in powerup_stats_map:
            powerup_stats_map[name] = {
                "username": name,
                "avatar_url": avatar,
                "base_powerups": base or 10,
                "used_matches": []
            }

    # 4. Global Accuracy Stats (Max 55 points per match)
    accuracy_res = await db.execute(
        select(
            User.id,
            User.name,
            func.sum(
                case(
                    (Prediction.use_powerup == "Yes", Prediction.points_awarded / 2),
                    else_=func.coalesce(Prediction.points_awarded, 0)
                )
            ).label("base_match_points"),
            func.count(Match.id).label("completed_matches")
        )
        .join(Prediction, User.id == Prediction.user_id)
        .join(Match, Prediction.match_id == Match.id)
        .where(Match.status == "completed")
        .where(User.is_guest == False)
        .group_by(User.id, User.name)
    )
    
    accuracy_map = {}
    for uid, name, base_pts, count in accuracy_res.all():
        if count > 0:
            accuracy_map[name] = round((base_pts / (count * 55)) * 100, 1)

    # 5. Match Wins Stats (Who won the most matches)
    match_wins_res = await db.execute(
        select(Match.id, User.name, LeaderboardEntry.points)
        .join(LeaderboardEntry, Match.id == LeaderboardEntry.match_id)
        .join(User, LeaderboardEntry.user_id == User.id)
        .where(Match.status == "completed")
        .where(User.is_guest == False)
    )
    
    match_scores = {} # match_id -> List of (username, points)
    for mid, name, pts in match_wins_res.all():
        if mid not in match_scores:
            match_scores[mid] = []
        match_scores[mid].append((name, pts))
        
    user_wins_map = {} # username -> List of match_numbers
    for mid, players in match_scores.items():
        if not players: continue
        max_pts = max(p[1] for p in players)
        # Rule: Any player with the max score is a winner
        winners = [p[0] for p in players if p[1] == max_pts]
        m_no = mid.split("-")[2] if "-" in mid else mid
        for winner_name in winners:
            if winner_name not in user_wins_map:
                user_wins_map[winner_name] = []
            user_wins_map[winner_name].append(m_no)

    analysis_data = {
        "weekly_podium": weekly_stats[:5],
        "recent_podiums": await get_match_podiums(db),
        "powerups_stats": [
            {
                **v, 
                "prediction_accuracy": accuracy_map.get(k, 0),
                "match_wins": len(user_wins_map.get(k, [])),
                "won_matches": sorted(user_wins_map.get(k, []), key=lambda x: int(x) if x.isdigit() else 0)
            } 
            for k, v in powerup_stats_map.items()
        ]
    }
    
    backend_cache.set(cache_key, analysis_data)
    return analysis_data

