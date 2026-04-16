import uuid
from datetime import datetime, UTC, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import User, MatchV2, PredictionV2, MatchStatus
from backend.utils.email import send_prediction_confirmation
import asyncio

router = APIRouter(prefix="/v2/matches", tags=["matches_v2"])

class PredictionInput(BaseModel):
    answers: Dict[str, str | int | List[str]] = {} # Dynamic answers mapping JSON question_id to response
    use_powerup: Optional[str] = "No"

@router.get("")
async def list_matches(db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = today_start + timedelta(days=3)
    
    result = await db.execute(
        select(MatchV2)
        .where(
            ((MatchV2.toss_time >= today_start) & (MatchV2.toss_time <= cutoff)) & 
            ((MatchV2.status == MatchStatus.upcoming) | (MatchV2.status == MatchStatus.completed))
        )
        .order_by(MatchV2.toss_time.asc())
    )
    matches_objs = result.scalars().all()
    
    # Force dictionary conversion to ensure all fields (including ground truth) are serialized
    matches = []
    for m in matches_objs:
        matches.append({
            "id": m.id,
            "team1": m.team1,
            "team2": m.team2,
            "venue": m.venue,
            "toss_time": m.toss_time,
            "status": m.status,
            "questions_json": m.questions_json,
            "answers_json": m.answers_json
        })
    return matches

@router.get("/{match_id}")
async def get_match(match_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MatchV2).where(MatchV2.id == match_id))
    m = result.scalars().first()
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
        
    match_dict = {
        "id": m.id,
        "team1": m.team1,
        "team2": m.team2,
        "venue": m.venue,
        "toss_time": m.toss_time,
        "status": m.status,
        "questions_json": m.questions_json,
        "answers_json": m.answers_json
    }
        
    # In V2, we return the match's dynamic questions instead of hardcoded ones
    questions = m.questions_json or []
    
    # Calculate powerups used across all matches for this user
    p_result = await db.execute(
        select(PredictionV2)
        .where(PredictionV2.user_id == current_user.id)
        .where(PredictionV2.use_powerup == "Yes")
    )
    powerups_used = len(p_result.scalars().all())

    return {"match": match_dict, "questions": questions, "powerups_used": powerups_used, "total_powerups": current_user.base_powerups}

@router.post("/{match_id}/predictions")
async def submit_prediction(match_id: str, payload: PredictionInput, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MatchV2).where(MatchV2.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if datetime.now(UTC) > (match.toss_time - timedelta(minutes=30)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Predictions are locked for this match")
        
    # Check what user already predicted for this match
    pred_stmt = select(PredictionV2).where(PredictionV2.user_id == current_user.id).where(PredictionV2.match_id == match_id)
    pred_result = await db.execute(pred_stmt)
    existing_pred = pred_result.scalars().first()
    
    # Check Powerup Limit (allotted base_powerups per season)
    if payload.use_powerup == "Yes":
        is_already_using = existing_pred and existing_pred.use_powerup == "Yes"
        
        if not is_already_using:
            total_up_result = await db.execute(
                select(PredictionV2)
                .where(PredictionV2.user_id == current_user.id)
                .where(PredictionV2.use_powerup == "Yes")
            )
            total_used = len(total_up_result.scalars().all())
            
            if total_used >= current_user.base_powerups:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="powerup_limit_reached"
                )

    if existing_pred:
        existing_pred.answers_json = payload.answers
        existing_pred.use_powerup = payload.use_powerup
    else:
        new_pred = PredictionV2(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            match_id=match_id,
            answers_json=payload.answers,
            use_powerup=payload.use_powerup
        )
        db.add(new_pred)
            
    await db.commit()

    match_number = match.external_id.split("-")[2]
    
    # Trigger confirmation email in the background 
    # to avoid slowing down the user's response time
    # match_title = f"Match {match_number}: {match.team1} vs {match.team2}"
    # asyncio.create_task(send_prediction_confirmation(
    #     current_user.email, 
    #     current_user.name, 
    #     match_title,
    #     match.team1,
    #     match.team2,
    #     payload.model_dump()
    # ))
            
    return {"message": "Predictions submitted successfully"}

@router.get("/{match_id}/predictions/mine")
async def get_my_predictions(match_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    pred_result = await db.execute(select(PredictionV2).where(PredictionV2.user_id == current_user.id).where(PredictionV2.match_id == match_id))
    pred = pred_result.scalars().first()
    
    if not pred:
        return {}
            
    return {
        "answers": pred.answers_json or {},
        "use_powerup": pred.use_powerup or "No"
    }

@router.get("/{match_id}/predictions/all")
async def get_all_community_predictions(match_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(MatchV2).where(MatchV2.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Masking logic for upcoming matches:
    # Reveal WHOM but hide WHAT until 30 minutes before toss
    is_locked = datetime.now(UTC) >= (match.toss_time - timedelta(minutes=30))
        
    pred_result = await db.execute(
        select(PredictionV2, User)
        .join(User, PredictionV2.user_id == User.id)
        .where(PredictionV2.match_id == match_id)
    )
    
    results = []
    for pred, user in pred_result.all():
        if is_locked:
            answers = pred.answers_json or {}
            answers["use_powerup"] = pred.use_powerup
        else:
            # Mask the data
            answers = {}
            if pred.answers_json:
                for k in pred.answers_json.keys():
                    answers[k] = "🔒"
            answers["use_powerup"] = "🔒"
            
        results.append({
            "prediction_id": pred.id,
            "user": {"id": user.id, "name": user.name, "avatar_url": user.avatar_url},
            "answers": answers
        })
        
    return results
