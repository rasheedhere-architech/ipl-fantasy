import uuid
from datetime import datetime, UTC, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_

from backend.database import get_db
from backend.dependencies import get_current_user, get_current_user_optional
from backend.models import User, Match, Prediction, MatchStatus
from backend.utils.email import send_prediction_confirmation
from backend.utils.cache import backend_cache
import asyncio

router = APIRouter(prefix="/matches", tags=["matches"])

class PredictionInput(BaseModel):
    match_winner: Optional[str] = None
    team1_powerplay: Optional[int] = None
    team2_powerplay: Optional[int] = None
    player_of_the_match: Optional[str] = None
    more_sixes_team: Optional[str] = None
    more_fours_team: Optional[str] = None
    use_powerup: Optional[str] = "No"

@router.get("")
async def list_matches(db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = today_start + timedelta(days=3)
    
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Match)
        .options(selectinload(Match.reporter))
        .where(
            ((Match.toss_time >= today_start) & (Match.toss_time <= cutoff)) & 
            ((Match.status == MatchStatus.upcoming) | (Match.status == MatchStatus.completed))
        )
        .order_by(Match.toss_time.asc())
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
            "winner": m.winner,
            "team1_powerplay_score": m.team1_powerplay_score,
            "team2_powerplay_score": m.team2_powerplay_score,
            "player_of_the_match": m.player_of_the_match,
            "reported_by_name": m.reporter.name if m.reporter else None,
            "reported_by_email": m.reporter.email if m.reporter else None,
            "report_method": m.report_method,
            "more_sixes_team": m.more_sixes_team,
            "more_fours_team": m.more_fours_team
        })
    return matches

@router.post("/{match_id}/autopredict")
async def post_autopredict(match_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="Guests cannot submit predictions")
    
    import random

    result = await db.execute(select(Match).where(Match.id == match_id))
    match_obj = result.scalars().first()
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")

    # Respect toss lock
    from datetime import timedelta
    if datetime.now(UTC) > (match_obj.toss_time - timedelta(minutes=30)):
        raise HTTPException(status_code=403, detail="Predictions are locked for this match")

    # Guard: only allow once per user per match
    existing = await db.execute(
        select(Prediction).where(Prediction.user_id == current_user.id, Prediction.match_id == match_id)
    )
    existing_pred = existing.scalars().first()
    if existing_pred:
        raise HTTPException(status_code=400, detail="Prediction already exists for this match")

    winner = match_obj.team1 if random.random() > 0.5 else match_obj.team2

    async def get_team_stats(team_name: str) -> dict:
        stmt = select(Match.team1, Match.team2, Match.team1_powerplay_score, Match.team2_powerplay_score, Match.player_of_the_match, Match.winner).where(
            or_(Match.team1 == team_name, Match.team2 == team_name)
        )
        res = await db.execute(stmt)
        matches = res.all()

        scores = []
        potm_players = []

        for m in matches:
            if m.team1 == team_name and m.team1_powerplay_score is not None:
                scores.append(m.team1_powerplay_score)
            elif m.team2 == team_name and m.team2_powerplay_score is not None:
                scores.append(m.team2_powerplay_score)

            if m.winner == team_name and m.player_of_the_match:
                potm_players.append(m.player_of_the_match)

        avg_pp = int(sum(scores) / len(scores)) if scores else random.randint(50, 70)
        potm_list = [p for p in potm_players if p and p.strip()]

        stats = {"avg_pp": avg_pp, "potm": potm_list}
        return stats

    team1_stats = await get_team_stats(match_obj.team1)
    team2_stats = await get_team_stats(match_obj.team2)

    team1_pp = team1_stats["avg_pp"] + random.randint(-5, 5)
    team2_pp = team2_stats["avg_pp"] + random.randint(-5, 5)

    winner_stats = team1_stats if winner == match_obj.team1 else team2_stats
    players = winner_stats["potm"]
    potm = random.choice(players) if players else f"Star Player ({winner})"

    # 4. More Sixes and More Fours (Randomly choose for matches >= 39)
    match_number = 0
    if "-" in match_id:
        try:
            match_number = int(match_id.split("-")[-1])
        except ValueError:
            pass
            
    more_sixes_team = None
    more_fours_team = None
    if match_number >= 39:
        more_sixes_team = match_obj.team1 if random.random() > 0.5 else match_obj.team2
        more_fours_team = match_obj.team1 if random.random() > 0.5 else match_obj.team2

    # Persist auto-prediction to DB
    new_pred = Prediction(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        match_id=match_id,
        match_winner=winner,
        team1_powerplay=team1_pp,
        team2_powerplay=team2_pp,
        player_of_the_match=potm,
        more_sixes_team=more_sixes_team,
        more_fours_team=more_fours_team,
        use_powerup="No",
        is_auto_predicted=True,
    )
    db.add(new_pred)
    await db.commit()

    return {
        "match_winner": winner,
        "team1_powerplay": team1_pp,
        "team2_powerplay": team2_pp,
        "player_of_the_match": potm,
        "more_sixes_team": more_sixes_team,
        "more_fours_team": more_fours_team,
        "use_powerup": "No"
    }

@router.get("/{match_id}")
async def get_match(match_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(Match).options(selectinload(Match.reporter)).where(Match.id == match_id))
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
        "winner": m.winner,
        "team1_powerplay_score": m.team1_powerplay_score,
        "team2_powerplay_score": m.team2_powerplay_score,
        "player_of_the_match": m.player_of_the_match,
        "reported_by_name": m.reporter.name if m.reporter else None,
        "reported_by_email": m.reporter.email if m.reporter else None,
        "report_method": m.report_method,
        "more_sixes_team": m.more_sixes_team,
        "more_fours_team": m.more_fours_team
    }
        
    # Hardcoded question metadata for frontend compatibility
    questions = [
        {"key": "match_winner", "question_text": "Match Winner", "answer_type": "text"},
        {"key": "team1_powerplay", "question_text": f"{m.team1} Power Play Score", "answer_type": "number"},
        {"key": "team2_powerplay", "question_text": f"{m.team2} Power Play Score", "answer_type": "number"},
        {"key": "player_of_the_match", "question_text": "Player of the Match", "answer_type": "player_name"},
        {"key": "use_powerup", "question_text": "Use 2x Powerup for this match?", "answer_type": "text"}
    ]
    
    # Add new questions for match 39 onwards
    match_number = 0
    if "-" in match_id:
        try:
            match_number = int(match_id.split("-")[-1])
        except ValueError:
            pass
            
    if match_number >= 39:
        # Insert before use_powerup
        questions.insert(-1, {"key": "more_sixes_team", "question_text": "Team to score more 6s", "answer_type": "text"})
        questions.insert(-1, {"key": "more_fours_team", "question_text": "Team to score more 4s", "answer_type": "text"})
    
    # Calculate powerups used across all matches for this user
    p_result = await db.execute(
        select(Prediction)
        .where(Prediction.user_id == current_user.id)
        .where(Prediction.use_powerup == "Yes")
    )
    powerups_used = len(p_result.scalars().all())

    return {"match": match_dict, "questions": questions, "powerups_used": powerups_used, "total_powerups": current_user.base_powerups}

@router.post("/{match_id}/predictions")
async def submit_prediction(match_id: str, payload: PredictionInput, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="Guests cannot submit predictions")
        
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    if datetime.now(UTC) > (match.toss_time - timedelta(minutes=30)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Predictions are locked for this match")
        
    # Check what user already predicted for this match
    pred_stmt = select(Prediction).where(Prediction.user_id == current_user.id).where(Prediction.match_id == match_id)
    pred_result = await db.execute(pred_stmt)
    existing_pred = pred_result.scalars().first()
    
    # Check Powerup Limit (allotted base_powerups per season)
    if payload.use_powerup == "Yes":
        is_already_using = existing_pred and existing_pred.use_powerup == "Yes"
        
        if not is_already_using:
            total_up_result = await db.execute(
                select(Prediction)
                .where(Prediction.user_id == current_user.id)
                .where(Prediction.use_powerup == "Yes")
            )
            total_used = len(total_up_result.scalars().all())
            
            if total_used >= current_user.base_powerups:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="powerup_limit_reached"
                )

    if existing_pred:
        existing_pred.match_winner = payload.match_winner
        existing_pred.team1_powerplay = payload.team1_powerplay
        existing_pred.team2_powerplay = payload.team2_powerplay
        existing_pred.player_of_the_match = payload.player_of_the_match
        existing_pred.more_sixes_team = payload.more_sixes_team
        existing_pred.more_fours_team = payload.more_fours_team
        existing_pred.use_powerup = payload.use_powerup
        # Keep is_auto_predicted status if it was already True
        # existing_pred.is_auto_predicted = False (Removed)
    else:
        new_pred = Prediction(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            match_id=match_id,
            match_winner=payload.match_winner,
            team1_powerplay=payload.team1_powerplay,
            team2_powerplay=payload.team2_powerplay,
            player_of_the_match=payload.player_of_the_match,
            more_sixes_team=payload.more_sixes_team,
            more_fours_team=payload.more_fours_team,
            use_powerup=payload.use_powerup,
            is_auto_predicted=False
        )
        db.add(new_pred)
            
    await db.commit()
    
    # Invalidate prediction status cache
    backend_cache.invalidate(f"user_pred_status:{current_user.id}")

    match_number = match.external_id.split("-")[-1] if match.external_id else "0"
    
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
    pred_result = await db.execute(select(Prediction).where(Prediction.user_id == current_user.id).where(Prediction.match_id == match_id))
    pred = pred_result.scalars().first()
    
    if not pred:
        return {}
            
    return {
        "match_winner": pred.match_winner or "",
        "team1_powerplay": pred.team1_powerplay or "",
        "team2_powerplay": pred.team2_powerplay or "",
        "player_of_the_match": pred.player_of_the_match or "",
        "more_sixes_team": pred.more_sixes_team or "",
        "more_fours_team": pred.more_fours_team or "",
        "use_powerup": pred.use_powerup or "No",
        "is_auto_predicted": pred.is_auto_predicted
    }

@router.get("/{match_id}/predictions/all")
async def get_all_community_predictions(match_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Masking logic for upcoming matches:
    # Reveal WHOM but hide WHAT until 30 minutes before toss
    is_locked = datetime.now(UTC) >= (match.toss_time - timedelta(minutes=30))
        
    from backend.models import AllowlistedEmail
    pred_result = await db.execute(
        select(Prediction, User)
        .join(User, Prediction.user_id == User.id)
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .where(Prediction.match_id == match_id)
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
    )
    
    results = []
    for pred, user in pred_result.all():
        if is_locked:
            answers = {
                "match_winner": pred.match_winner,
                "team1_powerplay": pred.team1_powerplay,
                "team2_powerplay": pred.team2_powerplay,
                "player_of_the_match": pred.player_of_the_match,
                "more_sixes_team": pred.more_sixes_team,
                "more_fours_team": pred.more_fours_team,
                "use_powerup": pred.use_powerup
            }
        else:
            # Mask the data
            answers = {
                "match_winner": "🔒",
                "team1_powerplay": "🔒",
                "team2_powerplay": "🔒",
                "player_of_the_match": "🔒",
                "more_sixes_team": "🔒",
                "more_fours_team": "🔒",
                "use_powerup": "🔒"
            }
            
        results.append({
            "prediction_id": pred.id,
            "user": {"id": user.id, "name": user.name, "avatar_url": user.avatar_url},
            "answers": answers,
            "is_auto_predicted": pred.is_auto_predicted,
            "points_awarded": pred.points_awarded,
            "points_breakdown": pred.points_breakdown
        })
        
    return results

@router.get("/my/prediction-status")
async def get_my_prediction_status(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """ Returns a list of match_ids that the current user has already predicted for """
    if current_user.is_guest:
        return []
    
    cache_key = f"user_pred_status:{current_user.id}"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached
    
    res = await db.execute(
        select(Prediction.match_id)
        .where(Prediction.user_id == current_user.id)
    )
    match_ids = res.scalars().all()
    
    backend_cache.set(cache_key, match_ids)
    return match_ids
