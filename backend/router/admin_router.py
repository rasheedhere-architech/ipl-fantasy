import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.database import get_db
from backend.models import User, AllowlistedEmail, Match, LeagueAdminMapping, TournamentUserMapping
from backend.dependencies import get_current_admin, get_current_user
from backend.scoring import calculate_match_scores
from backend.utils.cache import backend_cache

router = APIRouter(prefix="/api/admin", tags=["admin"])

class MatchResultUpdate(BaseModel):
    answers: dict

class AllowlistEmailsRequest(BaseModel):
    emails: List[str]
    is_guest: bool = False

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
            new_entry = AllowlistedEmail(email=clean_email, is_guest=data.is_guest)
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
async def get_all_users(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        res = await db.execute(select(LeagueAdminMapping).where(LeagueAdminMapping.user_id == current_user.id))
        if not res.scalars().first():
            raise HTTPException(status_code=403, detail="Not authorized")
            
    result = await db.execute(select(User).where(User.is_guest == False).order_by(User.created_at.desc()))
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
    
    # Save the entire raw blob for audit/future use
    match.raw_result_json = answers

    # Mark as completed and save reporter
    from backend.models import MatchStatus
    match.status = MatchStatus.completed
    match.reported_by = current_admin.id
    match.report_method = "manual"
    await db.commit()
    await db.refresh(match)

    print(f"Match {match_id} results saved: {answers.get('winner') or 'Dynamic Results'}")

    # Trigger scoring engine

    await calculate_match_scores(match_id, db)
    
    # Invalidate Leaderboards after scoring update
    backend_cache.invalidate("global_leaderboard")
    backend_cache.invalidate("match_podiums")
    backend_cache.invalidate("analysis")
    backend_cache.invalidate(f"match_leaderboard_{match_id}")
    
    return {"message": "Results saved and scoring triggered successfully"}


@router.put("/users/{user_id}/base-stats")
async def update_user_base_stats(user_id: str, payload: dict, db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # User-level attributes
    if "is_telegram_admin" in payload:
        user.is_telegram_admin = bool(payload["is_telegram_admin"])
    if "telegram_username" in payload:
        user.telegram_username = payload["telegram_username"]
    
    # Tournament-scoped attributes
    tournament_id = payload.get("tournament_id")
    if tournament_id and ("base_points" in payload or "base_powerups" in payload):
        res = await db.execute(
            select(TournamentUserMapping).where(
                TournamentUserMapping.tournament_id == tournament_id,
                TournamentUserMapping.user_id == user_id
            )
        )
        mapping = res.scalars().first()
        if not mapping:
            mapping = TournamentUserMapping(
                tournament_id=tournament_id,
                user_id=user_id,
                base_points=0,
                base_powerups=10,
                powerups_used=0
            )
            db.add(mapping)
        
        if "base_points" in payload:
            mapping.base_points = int(payload["base_points"])
        if "base_powerups" in payload:
            mapping.base_powerups = int(payload["base_powerups"])

    await db.commit()
    
    # Invalidate Leaderboards
    backend_cache.invalidate("global_leaderboard")
    backend_cache.invalidate("analysis")
    
    return {
        "message": "User stats updated", 
        "user_id": user_id, 
        "is_telegram_admin": user.is_telegram_admin,
        "telegram_username": user.telegram_username
    }



@router.post("/trigger-ai-predictions")
async def trigger_ai_predictions(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    from backend.scheduler import auto_predict_daily_job
    import asyncio
    
    # Run the background job synchronously for the API response
    asyncio.create_task(auto_predict_daily_job())
    return {"message": "AI prediction job triggered in the background"}
