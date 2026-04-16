import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
import uuid
from backend.database import get_db
from backend.models import User, AllowlistedEmail, ScoringRule, Match, MatchV2, QuestionTemplate
from backend.dependencies import get_current_admin
from backend.scoring import calculate_match_scores, calculate_match_scores_v2
from backend.utils.cache import backend_cache

router = APIRouter(prefix="/admin", tags=["admin"])

class MatchResultUpdate(BaseModel):
    answers: dict

class AllowlistEmailsRequest(BaseModel):
    emails: List[str]

@router.get("/allowlist")
async def get_allowlist(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    cache_key = "allowlist"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    result = await db.execute(select(AllowlistedEmail).order_by(AllowlistedEmail.added_at.desc()))
    entries = result.scalars().all()
    backend_cache.set(cache_key, entries)
    return entries

@router.post("/allowlist")
async def add_to_allowlist(data: AllowlistEmailsRequest, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    added = []
    for email in data.emails:
        clean_email = email.strip().lower()
        if not clean_email:
            continue
        
        # Check if exists
        result = await db.execute(select(AllowlistedEmail).where(AllowlistedEmail.email == clean_email))
        if not result.scalars().first():
            new_entry = AllowlistedEmail(email=clean_email)
            db.add(new_entry)
            added.append(clean_email)
            
    await db.commit()
    backend_cache.invalidate("allowlist")
    return {"message": f"Added {len(added)} emails", "added": added}

@router.delete("/allowlist/{email}")
async def remove_from_allowlist(email: str, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    result = await db.execute(select(AllowlistedEmail).where(AllowlistedEmail.email == email))
    entry = result.scalars().first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Email not found in allowlist")
        
    await db.delete(entry)
    await db.commit()
    backend_cache.invalidate("allowlist")
    return {"message": f"Removed {email} from allowlist"}

@router.get("/users")
async def get_all_users(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()

@router.put("/scoring-rules")
async def update_scoring_rules(config: dict, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    rule = ScoringRule(id=str(uuid.uuid4()), config_json=config)
    db.add(rule)
    await db.commit()
    return {"message": "Scoring rules updated"}

@router.put("/matches/{match_id}/results")
async def trigger_match_scoring(match_id: str, payload: MatchResultUpdate, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    # answers is a dict of:
    # { "winner": "...", "team1_powerplay_score": 50, "team2_powerplay_score": 45, "player_of_the_match": "..." }
    answers = payload.answers
    
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Update Match Results
    if "winner" in answers:
        match.winner = str(answers["winner"])
    if "team1_powerplay_score" in answers:
        match.team1_powerplay_score = int(answers["team1_powerplay_score"])
    if "team2_powerplay_score" in answers:
        match.team2_powerplay_score = int(answers["team2_powerplay_score"])
    if "player_of_the_match" in answers:
        match.player_of_the_match = str(answers["player_of_the_match"])
    
    # Save the entire raw blob for audit/future use
    match.raw_result_json = answers
    
    # Mark as completed
    from backend.models import MatchStatus
    match.status = MatchStatus.completed
            
    await db.commit()
    await db.refresh(match)
    
    print(f"Match {match_id} results saved: {match.winner}, {match.team1_powerplay_score}-{match.team2_powerplay_score}")
    
    # Trigger scoring engine
    await calculate_match_scores(match_id, db)
    
    # Invalidate Leaderboards after scoring update
    backend_cache.invalidate("global_leaderboard")
    backend_cache.invalidate(f"match_leaderboard_{match_id}")
    
    return {"message": "Results saved and scoring triggered successfully"}
class TemplateCreateUpdate(BaseModel):
    name: str
    is_default: bool = False
    questions: List[dict]

@router.get("/v2/templates")
async def get_templates(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    result = await db.execute(select(QuestionTemplate))
    templates = result.scalars().all()
    return templates

@router.post("/v2/templates")
async def create_template(payload: TemplateCreateUpdate, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    if payload.is_default:
        await db.execute(update(QuestionTemplate).values(is_default=False))
    
    template = QuestionTemplate(
        id=str(uuid.uuid4()),
        name=payload.name,
        is_default=payload.is_default,
        questions_json=payload.questions
    )
    db.add(template)
    await db.commit()
    return {"id": template.id, "message": "Template created"}

class MatchV2QuestionsUpdate(BaseModel):
    questions: List[dict]

@router.put("/v2/matches/{match_id}/questions")
async def set_match_questions(match_id: str, payload: MatchV2QuestionsUpdate, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    result = await db.execute(select(MatchV2).where(MatchV2.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    match.questions_json = payload.questions
    await db.commit()
    return {"message": "Match V2 questions updated successfully"}

@router.put("/v2/matches/{match_id}/results")
async def trigger_match_scoring_v2(match_id: str, payload: MatchResultUpdate, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    answers = payload.answers
    
    result = await db.execute(select(MatchV2).where(MatchV2.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    match.answers_json = answers
    
    from backend.models import MatchStatus
    match.status = MatchStatus.completed
    
    await db.commit()
    
    await calculate_match_scores_v2(match_id, db)
    
    backend_cache.invalidate("global_leaderboard")
    backend_cache.invalidate(f"match_leaderboard_{match_id}")
    
    return {"message": "V2 Results saved and dynamic scoring triggered successfully"}

@router.put("/predictions/{prediction_id}")
async def admin_update_prediction(prediction_id: str, updates: dict, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    from backend.models import Prediction
    result = await db.execute(select(Prediction).where(Prediction.id == prediction_id))
    pred = result.scalars().first()
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction not found")
    
    if "player_of_the_match" in updates:
        pred.player_of_the_match = str(updates["player_of_the_match"])
        
    await db.commit()
    return {"message": "Prediction updated successfully", "prediction_id": prediction_id}

@router.put("/users/{user_id}/base-points")
async def update_user_base_points(user_id: str, payload: dict, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if "base_points" in payload:
        user.base_points = int(payload["base_points"])
    if "base_powerups" in payload:
        user.base_powerups = int(payload["base_powerups"])
        
    await db.commit()
    
    # Invalidate Leaderboards after user stat adjustment
    backend_cache.invalidate("global_leaderboard")
    
    return {"message": "User base stats updated", "user_id": user_id, "base_points": user.base_points, "base_powerups": user.base_powerups}
