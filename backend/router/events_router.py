from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, desc
from typing import List

from backend.database import get_db
from backend.models import User, SystemEvent, LeagueUserMapping
from backend.dependencies import get_current_user

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("")
async def get_events(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches system events based on user visibility.
    - Global Admins see everything.
    - Regular users see:
        1. Their own events.
        2. Events in leagues they belong to.
        3. Public events (no league_id).
    """
    query = select(SystemEvent, User.name, User.avatar_url).outerjoin(User, SystemEvent.user_id == User.id)

    if not current_user.is_admin:
        # Get leagues user belongs to
        leagues_res = await db.execute(
            select(LeagueUserMapping.league_id).where(LeagueUserMapping.user_id == current_user.id)
        )
        user_league_ids = leagues_res.scalars().all()

        query = query.where(
            or_(
                SystemEvent.user_id == current_user.id,
                SystemEvent.league_id.in_(user_league_ids),
                SystemEvent.league_id.is_(None)
            )
        )

    query = query.order_by(desc(SystemEvent.timestamp)).limit(limit)
    result = await db.execute(query)
    events_raw = result.all()

    formatted_events = []
    for event, user_name, user_avatar in events_raw:
        formatted_events.append({
            "id": event.id,
            "event_type": event.event_type,
            "timestamp": event.timestamp,
            "user_id": event.user_id,
            "username": user_name or "System",
            "user_avatar": user_avatar,
            "league_id": event.league_id,
            "match_id": event.match_id,
            "message": event.message,
            "payload": event.payload
        })

    return formatted_events
