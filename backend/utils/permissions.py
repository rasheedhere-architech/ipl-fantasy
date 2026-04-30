from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.models import User, Campaign, LeagueAdminMapping

async def is_league_admin(db: AsyncSession, user_id: str, league_id: str) -> bool:
    result = await db.execute(select(LeagueAdminMapping).where(
        LeagueAdminMapping.league_id == league_id,
        LeagueAdminMapping.user_id == user_id
    ))
    return result.scalars().first() is not None

async def check_campaign_permission(db: AsyncSession, campaign: Campaign, current_user: User):
    if current_user.is_admin:
        return
    if campaign.league_id:
        if await is_league_admin(db, current_user.id, campaign.league_id):
            return
    raise HTTPException(status_code=403, detail="Not authorized to manage this campaign")
