from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
import secrets

from backend.database import get_db
from backend.models import User, League, LeagueUserMapping, LeagueAdminMapping, Tournament, TournamentStatus
from backend.router.auth_router import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/leagues", tags=["Leagues"])

class LeagueCreateReq(BaseModel):
    name: str
    tournament_id: str
    starting_powerups: Optional[int] = 0

class LeagueJoinReq(BaseModel):
    join_code: str

class AddMemberReq(BaseModel):
    user_id: str



def generate_join_code() -> str:
    return secrets.token_hex(4).upper()

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_league(
    req: LeagueCreateReq,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only global admins can create leagues")
    # Verify tournament exists
    tournament = await db.get(Tournament, req.tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
        
    league_id = f"league-{uuid.uuid4()}"
    final_join_code = generate_join_code()
    
    new_league = League(
        id=league_id,
        name=req.name,
        tournament_id=req.tournament_id,
        join_code=final_join_code,
        starting_powerups=req.starting_powerups,
        created_by=current_user.id
    )
    db.add(new_league)
    
    # Add creator as admin
    admin_mapping = LeagueAdminMapping(league_id=league_id, user_id=current_user.id)
    db.add(admin_mapping)
    
    # Add creator as a participant
    user_mapping = LeagueUserMapping(
        league_id=league_id,
        user_id=current_user.id,
        remaining_powerups=req.starting_powerups
    )
    db.add(user_mapping)
    
    await db.commit()
    await db.refresh(new_league)
    return {"message": "League created successfully", "league_id": league_id, "join_code": new_league.join_code}

@router.get("/")
async def get_my_leagues(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get leagues where the user is a participant, or all if global admin
    if current_user.is_admin:
        result = await db.execute(
            select(League)
            .options(selectinload(League.admins))
        )
    else:
        result = await db.execute(
            select(League)
            .join(LeagueUserMapping, League.id == LeagueUserMapping.league_id)
            .where(LeagueUserMapping.user_id == current_user.id)
            .options(selectinload(League.admins))
        )
    leagues = result.scalars().all()
    
    response = []
    for l in leagues:
        is_admin = any(a.id == current_user.id for a in l.admins)
        response.append({
            "id": l.id,
            "name": l.name,
            "tournament_id": l.tournament_id,
            "is_admin": is_admin,
            "join_code": l.join_code if is_admin else None,
            "created_at": l.created_at
        })
    return response

@router.post("/join")
async def join_league(
    req: LeagueJoinReq,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Find league by join code
    result = await db.execute(select(League).where(League.join_code == req.join_code))
    league = result.scalars().first()
    
    if not league:
        raise HTTPException(status_code=404, detail="Invalid join code")
        
    # Check if already joined
    existing = await db.get(LeagueUserMapping, (league.id, current_user.id))
    if existing:
        raise HTTPException(status_code=400, detail="Already a member of this league")
        
    mapping = LeagueUserMapping(
        league_id=league.id,
        user_id=current_user.id,
        remaining_powerups=league.starting_powerups
    )
    db.add(mapping)
    await db.commit()
    
    # Immediately backfill the leaderboard cache for this new member
    from backend.scoring import update_leaderboard_cache
    await update_leaderboard_cache(db, league.tournament_id)
    
    return {"message": f"Successfully joined {league.name}", "league_id": league.id}

@router.get("/{league_id}")
async def get_league_details(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Ensure user is a participant
    mapping = await db.get(LeagueUserMapping, (league_id, current_user.id))
    if not mapping and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
        
    result = await db.execute(
        select(League)
        .where(League.id == league_id)
        .options(
            selectinload(League.admins),
            selectinload(League.participants)
        )
    )
    league = result.scalars().first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
        
    is_admin = any(a.id == current_user.id for a in league.admins)
    
    admin_ids = {a.id for a in league.admins}
    
    participants = []
    # Optionally load remaining_powerups for members if needed
    for p in league.participants:
        p_mapping = await db.get(LeagueUserMapping, (league.id, p.id))
        participants.append({
            "id": p.id,
            "name": p.name,
            "avatar_url": p.avatar_url,
            "joined_at": p_mapping.joined_at if p_mapping else None,
            "remaining_powerups": p_mapping.remaining_powerups if p_mapping else 0,
            "is_league_admin": p.id in admin_ids
        })
        
    return {
        "id": league.id,
        "name": league.name,
        "tournament_id": league.tournament_id,
        "is_admin": is_admin,
        "join_code": league.join_code if is_admin else None,
        "starting_powerups": league.starting_powerups,
        "participants": participants
    }

@router.delete("/{league_id}/members/{user_id}")
async def kick_member(
    league_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify current user is league admin
    admin_check = await db.get(LeagueAdminMapping, (league_id, current_user.id))
    if not admin_check and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to manage this league")
        
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot kick yourself")
        
    mapping = await db.get(LeagueUserMapping, (league_id, user_id))
    if not mapping:
        raise HTTPException(status_code=404, detail="User not in league")
        
    await db.delete(mapping)
    
    # Also remove from admin if they were an admin
    admin_map = await db.get(LeagueAdminMapping, (league_id, user_id))
    if admin_map:
        await db.delete(admin_map)
        
    await db.commit()
    return {"message": "User removed from league"}

class ToggleAdminReq(BaseModel):
    is_admin: bool

@router.put("/{league_id}/members/{user_id}/admin")
async def toggle_league_admin(
    league_id: str,
    user_id: str,
    req: ToggleAdminReq,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify current user is league admin or global admin
    admin_check = await db.get(LeagueAdminMapping, (league_id, current_user.id))
    if not admin_check and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to manage this league")
        
    # Check if user is actually in the league
    mapping = await db.get(LeagueUserMapping, (league_id, user_id))
    if not mapping:
        raise HTTPException(status_code=404, detail="User not in league")
        
    admin_map = await db.get(LeagueAdminMapping, (league_id, user_id))
    
    if req.is_admin and not admin_map:
        new_admin = LeagueAdminMapping(league_id=league_id, user_id=user_id)
        db.add(new_admin)
    elif not req.is_admin and admin_map:
        await db.delete(admin_map)
        
    await db.commit()
    return {"message": "Admin status updated"}

@router.post("/{league_id}/refresh_code")
async def refresh_join_code(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    admin_check = await db.get(LeagueAdminMapping, (league_id, current_user.id))
    if not admin_check and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
        
    league.join_code = generate_join_code()
    await db.commit()
    return {"message": "Join code refreshed", "join_code": league.join_code}

@router.post("/{league_id}/members")
async def add_member(
    league_id: str,
    req: AddMemberReq,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.is_admin:
        admin_map = await db.get(LeagueAdminMapping, (league_id, current_user.id))
        if not admin_map:
            raise HTTPException(status_code=403, detail="Not authorized")
        
    league = await db.get(League, league_id)
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
        
    user_to_add = await db.get(User, req.user_id)
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if already in league
    existing = await db.get(LeagueUserMapping, (league_id, req.user_id))
    if existing:
        raise HTTPException(status_code=400, detail="User already in league")
        
    mapping = LeagueUserMapping(
        league_id=league_id,
        user_id=req.user_id,
        remaining_powerups=league.starting_powerups
    )
    db.add(mapping)
    await db.commit()
    
    # Refresh cache
    from backend.scoring import update_leaderboard_cache
    await update_leaderboard_cache(db, league.tournament_id)
    
    return {"message": f"Added {user_to_add.name} to {league.name}"}
