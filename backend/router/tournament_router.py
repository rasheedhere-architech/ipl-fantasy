from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime
import csv
from io import StringIO

from backend.database import get_db
from backend.models import User, Tournament, TournamentStatus, League, Match, MatchStatus
from backend.dependencies import get_current_user
from backend.router.leaderboard_router import fetch_leaderboard_data
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

@router.post("/{tournament_id}/bulk-import-matches")
async def bulk_import_matches(
    tournament_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    contents = await file.read()
    decoded = contents.decode("utf-8")
    reader = csv.DictReader(StringIO(decoded))

    required_fields = ["id", "team1", "team2", "venue", "start_time"]
    if not reader.fieldnames or not all(field in reader.fieldnames for field in required_fields):
        raise HTTPException(status_code=400, detail=f"CSV must contain headers: {', '.join(required_fields)}")

    imported_count = 0
    for row in reader:
        match_id_raw = str(row["id"]).strip()
        if match_id_raw.isdigit():
            match_id = f"{tournament_id}-{match_id_raw}"
        else:
            match_id = match_id_raw

        # Check if match exists
        existing = await db.get(Match, match_id)
        if existing:
            continue

        try:
            start_time = datetime.fromisoformat(row["start_time"].replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format for match {match_id}. Use ISO format (e.g. 2026-03-22T19:30:00Z)")

        new_match = Match(
            id=match_id,
            tournament_id=tournament_id,
            team1=row["team1"],
            team2=row["team2"],
            venue=row["venue"],
            start_time=start_time,
            status=MatchStatus.upcoming
        )
        db.add(new_match)
        imported_count += 1

    await db.commit()
    return {"message": f"Successfully imported {imported_count} matches"}

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

@router.get("/{tournament_id}/leaderboard")
async def get_tournament_leaderboard(
    tournament_id: str,
    db: AsyncSession = Depends(get_db)
):
    # Use the shared logic with the global identifier
    return await fetch_leaderboard_data(db, f"{tournament_id}-global")
