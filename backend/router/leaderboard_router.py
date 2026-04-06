from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from backend.database import get_db
from backend.models import User, LeaderboardEntry, AllowlistedEmail

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

@router.get("")
async def get_global_leaderboard(db: AsyncSession = Depends(get_db)):
    # Group by user summing all points
    result = await db.execute(
        select(
            User.id,
            User.name,
            User.avatar_url,
            (func.coalesce(func.sum(LeaderboardEntry.points), 0) + User.base_points).label("total_points"),
            func.count(LeaderboardEntry.match_id).label("matches_played"),
            User.base_points
        )
        .join(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .outerjoin(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .group_by(User.id, User.base_points)
        .order_by((func.coalesce(func.sum(LeaderboardEntry.points), 0) + User.base_points).desc())
    )
    
    users_data = result.all()
    
    entries = []
    for rank, (uid, name, avatar, points, played, bp) in enumerate(users_data, start=1):
        # Fetch per-match progression for this user
        prog_res = await db.execute(
            select(LeaderboardEntry.points)
            .where(LeaderboardEntry.user_id == uid)
            .order_by(LeaderboardEntry.match_id.asc()) # Assuming chronological match IDs
        )
        progression = prog_res.scalars().all()
        
        entries.append({
            "rank": rank,
            "username": name,
            "avatar_url": avatar,
            "total_points": points,
            "matches_played": played,
            "base_points": bp,
            "progression": progression, # Array of [25, 10, -20...]
            "accuracy_pct": 0
        })
    return entries

@router.get("/match/{match_id}")
async def get_match_leaderboard(match_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User.id, User.name, User.avatar_url, LeaderboardEntry.points)
        .join(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .where(LeaderboardEntry.match_id == match_id)
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
    return entries
