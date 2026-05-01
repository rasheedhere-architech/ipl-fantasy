from sqlalchemy.ext.asyncio import AsyncSession
from backend.models import SystemEvent, SystemEventType
from typing import Optional
from datetime import datetime, UTC

async def dispatch_event(
    db: AsyncSession,
    event_type: SystemEventType,
    user_id: Optional[str] = None,
    league_id: Optional[str] = None,
    match_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
    priority: str = "low",
    message: Optional[str] = None,
    payload: Optional[dict] = None
):
    """Logs a system event and triggers potential side effects (future: push notifications)."""
    event = SystemEvent(
        event_type=event_type,
        user_id=user_id,
        league_id=league_id,
        match_id=match_id,
        campaign_id=campaign_id,
        target_user_id=target_user_id,
        priority=priority,
        message=message,
        payload=payload or {},
        timestamp=datetime.now(UTC)
    )
    db.add(event)
    # We usually don't commit here, let the caller commit with their transaction
    return event
