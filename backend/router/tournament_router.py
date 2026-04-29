from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from backend.database import get_db
from backend.models import User, Tournament, TournamentStatus, League
from backend.dependencies import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/tournaments", tags=["Tournaments"])

class TournamentCreate(BaseModel):
    id: str
    name: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_tournament(
    req: TournamentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    new_tournament = Tournament(
        id=req.id,
        name=req.name,
        starts_at=req.starts_at,
        ends_at=req.ends_at,
        status=TournamentStatus.upcoming
    )
    db.add(new_tournament)
    await db.commit()
    return {"message": "Tournament created successfully", "id": new_tournament.id}

@router.get("")
async def list_tournaments(db: AsyncSession = Depends(get_db)):
    # Include leagues as part of the response
    result = await db.execute(
        select(Tournament)
        .where(Tournament.status != TournamentStatus.completed)
        .options(selectinload(Tournament.leagues))
    )
    return result.scalars().all()

@router.get("/{tournament_id}/leagues")
async def get_tournament_leagues(
    tournament_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(League).where(League.tournament_id == tournament_id))
    return result.scalars().all()
