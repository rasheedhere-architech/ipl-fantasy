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
from backend.models import User, Match, Prediction, MatchStatus, Tournament
from backend.utils.email import send_prediction_confirmation
from backend.utils.cache import backend_cache
import asyncio

router = APIRouter(prefix="/api/matches", tags=["matches"])

class PredictionInput(BaseModel):
    match_winner: Optional[str] = None
    team1_powerplay: Optional[int] = None
    team2_powerplay: Optional[int] = None
    player_of_the_match: Optional[str] = None
    more_sixes_team: Optional[str] = None
    more_fours_team: Optional[str] = None
    use_powerup: Optional[str] = "No"
    extra_answers: Optional[Dict[str, str]] = {}

class MatchCreate(BaseModel):
    id: str
    team1: str
    team2: str
    venue: str
    toss_time: datetime
    tournament_id: str

@router.get("")
async def list_matches(tournament_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = today_start + timedelta(days=3)
    
    from sqlalchemy.orm import selectinload
    query = select(Match).options(selectinload(Match.reporter))
    
    if tournament_id:
        query = query.where(Match.tournament_id == tournament_id)
    else:
        query = query.where(
            ((Match.toss_time >= today_start) & (Match.toss_time <= cutoff)) & 
            ((Match.status == MatchStatus.upcoming) | (Match.status == MatchStatus.completed))
        )
        
    result = await db.execute(query.order_by(Match.toss_time.asc()))
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

    # Fetch League-specific Campaign Questions
    from backend.models import Campaign, CampaignQuestion, LeagueUserMapping
    # 1. Find the Master Campaign for this tournament
    master_result = await db.execute(select(Campaign).where(Campaign.tournament_id == m.tournament_id, Campaign.is_master == True, Campaign.type == "match"))
    master_campaign = master_result.scalars().first()
    
    if master_campaign and not current_user.is_guest:
        # 2. Find League Campaigns that have this Master Campaign as parent
        # AND belong to a league the user is in.
        league_c_result = await db.execute(
            select(Campaign)
            .join(LeagueUserMapping, LeagueUserMapping.league_id == Campaign.league_id)
            .options(selectinload(Campaign.questions))
            .where(Campaign.parent_campaign_id == master_campaign.id)
            .where(LeagueUserMapping.user_id == current_user.id)
            .where(Campaign.status == "active")
        )
        league_campaigns = league_c_result.scalars().all()
        
        for c in league_campaigns:
            for q in c.questions:
                # Add to questions array as dynamic questions
                questions.append({
                    "key": f"league_{c.id}_{q.id}",
                    "question_id": q.id,
                    "campaign_id": c.id,
                    "question_text": q.question_text,
                    "answer_type": q.question_type,
                    "options": q.options if hasattr(q, 'options') else None,
                    "league_id": c.league_id
                })

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
            
    if payload.extra_answers:
        from backend.models import CampaignResponse, CampaignAnswer
        
        # extra_answers structure from frontend: { "league_{campaign_id}_{question_id}": "answer_value" }
        campaign_answers_map = {}
        for key, value in payload.extra_answers.items():
            if key.startswith("league_"):
                parts = key.split("_")
                if len(parts) >= 3:
                    c_id = parts[1]
                    q_id = "_".join(parts[2:])
                    if c_id not in campaign_answers_map:
                        campaign_answers_map[c_id] = {}
                    campaign_answers_map[c_id][q_id] = value
                    
        for c_id, q_answers in campaign_answers_map.items():
            resp_stmt = select(CampaignResponse).where(CampaignResponse.campaign_id == c_id, CampaignResponse.user_id == current_user.id, CampaignResponse.match_id == match_id)
            c_resp = (await db.execute(resp_stmt)).scalars().first()
            
            if not c_resp:
                c_resp = CampaignResponse(
                    id=str(uuid.uuid4()),
                    campaign_id=c_id,
                    user_id=current_user.id,
                    match_id=match_id
                )
                db.add(c_resp)
                await db.flush()
                
            for q_id, a_val in q_answers.items():
                ans_stmt = select(CampaignAnswer).where(CampaignAnswer.response_id == c_resp.id, CampaignAnswer.question_id == q_id)
                ans = (await db.execute(ans_stmt)).scalars().first()
                if ans:
                    ans.answer_value = a_val
                else:
                    new_ans = CampaignAnswer(
                        id=str(uuid.uuid4()),
                        response_id=c_resp.id,
                        question_id=q_id,
                        answer_value=a_val
                    )
                    db.add(new_ans)
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
        
    from backend.models import CampaignResponse
    from sqlalchemy.orm import selectinload
    
    # Fetch extra answers
    extra_answers = {}
    cr_result = await db.execute(
        select(CampaignResponse)
        .options(selectinload(CampaignResponse.answers))
        .where(CampaignResponse.user_id == current_user.id, CampaignResponse.match_id == match_id)
    )
    campaign_responses = cr_result.scalars().all()
    for cr in campaign_responses:
        for ans in cr.answers:
            extra_answers[f"league_{cr.campaign_id}_{ans.question_id}"] = ans.answer_value
            
    response_data = {
        "match_winner": pred.match_winner or "",
        "team1_powerplay": pred.team1_powerplay or "",
        "team2_powerplay": pred.team2_powerplay or "",
        "player_of_the_match": pred.player_of_the_match or "",
        "more_sixes_team": pred.more_sixes_team or "",
        "more_fours_team": pred.more_fours_team or "",
        "use_powerup": pred.use_powerup or "No",
        "is_auto_predicted": pred.is_auto_predicted
    }
    
    if extra_answers:
        response_data["extra_answers"] = extra_answers
        
    return response_data

@router.get("/{match_id}/predictions/all")
async def get_all_community_predictions(match_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Masking logic for upcoming matches:
    # Reveal WHOM but hide WHAT until 30 minutes before toss
    is_locked = datetime.now(UTC) >= (match.toss_time - timedelta(minutes=30))
        
    from backend.models import AllowlistedEmail, CampaignResponse
    pred_result = await db.execute(
        select(Prediction, User)
        .join(User, Prediction.user_id == User.id)
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .where(Prediction.match_id == match_id)
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
    )
    
    # Fetch all campaign responses for this match
    cr_result = await db.execute(
        select(CampaignResponse)
        .options(selectinload(CampaignResponse.answers))
        .where(CampaignResponse.match_id == match_id)
    )
    all_crs = cr_result.scalars().all()
    
    # Map user_id -> extra_answers
    user_extra_answers = {}
    for cr in all_crs:
        if cr.user_id not in user_extra_answers:
            user_extra_answers[cr.user_id] = {}
        for ans in cr.answers:
            user_extra_answers[cr.user_id][f"league_{cr.campaign_id}_{ans.question_id}"] = ans.answer_value
    
    results = []
    for pred, user in pred_result.all():
        extra = user_extra_answers.get(user.id, {})
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
            if extra:
                answers.update(extra)
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
            if extra:
                for k in extra.keys():
                    answers[k] = "🔒"
            
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

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_match(
    req: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Verify tournament exists
    t_res = await db.execute(select(Tournament).where(Tournament.id == req.tournament_id))
    if not t_res.scalars().first():
        raise HTTPException(status_code=400, detail="Tournament not found")

    new_match = Match(
        id=req.id,
        team1=req.team1,
        team2=req.team2,
        venue=req.venue,
        toss_time=req.toss_time,
        tournament_id=req.tournament_id,
        status=MatchStatus.upcoming
    )
    db.add(new_match)
    await db.commit()
    return {"message": "Match created successfully", "id": new_match.id}
