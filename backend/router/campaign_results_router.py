import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.database import get_db
from backend.models import Campaign, CampaignMatchResult, CampaignQuestion, User
from backend.dependencies import get_current_user
from backend.campaigns_scoring import calculate_campaign_scores
from backend.utils.permissions import check_campaign_permission

router = APIRouter(prefix="/api/campaign-results", tags=["campaign-results"])

class CampaignMatchResultUpdate(BaseModel):
    correct_answers: dict # {question_id: answer_value}

@router.get("/{campaign_id}/{match_id}")
async def get_campaign_match_result(
    campaign_id: str,
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await check_campaign_permission(db, campaign, current_user)

    stmt = select(CampaignMatchResult).where(
        CampaignMatchResult.campaign_id == campaign_id,
        CampaignMatchResult.match_id == match_id
    )
    result = (await db.execute(stmt)).scalars().first()
    if not result:
        return {"campaign_id": campaign_id, "match_id": match_id, "correct_answers": {}}
    return result

@router.put("/{campaign_id}/{match_id}")
async def update_campaign_match_result(
    campaign_id: str,
    match_id: str,
    payload: CampaignMatchResultUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify campaign exists
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await check_campaign_permission(db, campaign, current_user)

    stmt = select(CampaignMatchResult).where(
        CampaignMatchResult.campaign_id == campaign_id,
        CampaignMatchResult.match_id == match_id
    )
    result = (await db.execute(stmt)).scalars().first()
    
    if result:
        result.correct_answers = payload.correct_answers
    else:
        result = CampaignMatchResult(
            id=str(uuid.uuid4()),
            campaign_id=campaign_id,
            match_id=match_id,
            correct_answers=payload.correct_answers
        )
        db.add(result)
    
    await db.commit()
    
    # Trigger scoring for this specific campaign
    # Note: calculate_campaign_scores currently scores ALL responses for a campaign.
    # For match-specific campaigns, we might need to filter by match_id if a campaign is used across multiple matches.
    # However, the current model assumes a campaign is either "general" or tied to a match via its own lifecycle.
    # If a campaign has a match_id, it's specific to that match.
    
    await calculate_campaign_scores(campaign_id, db)
    
    # Update leaderboard cache so league totals immediately reflect new campaign scores
    from backend.models import Match
    from backend.scoring import update_leaderboard_cache
    match = await db.get(Match, match_id)
    if match:
        await update_leaderboard_cache(db, match.tournament_id)
    
    return {"message": "Campaign results updated and scoring triggered"}

