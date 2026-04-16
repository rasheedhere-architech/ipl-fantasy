from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_

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
