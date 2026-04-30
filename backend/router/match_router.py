import uuid
from datetime import datetime, UTC, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.dependencies import get_current_user, get_current_user_optional
from backend.models import User, Match, Prediction, MatchStatus, Tournament
from backend.utils.email import send_prediction_confirmation
from backend.utils.cache import backend_cache
import asyncio

router = APIRouter(prefix="/api/matches", tags=["matches"])

class PredictionInput(BaseModel):
    use_powerup: Optional[str] = "No"
    # Unified answers dict: question_id or "league_{campaign_id}_{question_id}" -> value
    extra_answers: Optional[Dict[str, Any]] = {}

class MatchCreate(BaseModel):
    id: str
    team1: str
    team2: str
    venue: str
    start_time: datetime
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
            ((Match.start_time >= today_start) & (Match.start_time <= cutoff)) & 
            ((Match.status == MatchStatus.upcoming) | (Match.status == MatchStatus.completed))
        )
        
    result = await db.execute(query.order_by(Match.start_time.asc()))
    matches_objs = result.scalars().all()
    
    matches = []
    for m in matches_objs:
        matches.append({
            "id": m.id,
            "team1": m.team1,
            "team2": m.team2,
            "venue": m.venue,
            "tossTime": m.start_time.isoformat() if m.start_time else None,
            "start_time": m.start_time,
            "status": m.status,
            "winner": None,
            "team1_powerplay_score": None,
            "team2_powerplay_score": None,
            "player_of_the_match": None,
            "reported_by_name": m.reporter.name if m.reporter else None,
            "reported_by_email": m.reporter.email if m.reporter else None,
            "report_method": m.report_method,
            "more_sixes_team": None,
            "more_fours_team": None
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

    # Respect start lock
    start_time = match_obj.start_time
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=UTC)

    if datetime.now(UTC) > (start_time - timedelta(minutes=30)):
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
        from backend.models import CampaignMatchResult, Campaign, CampaignQuestion
        # Find all master campaigns for matches in this tournament
        stmt = (
            select(CampaignMatchResult.correct_answers, Match.team1, Match.team2)
            .join(Match, CampaignMatchResult.match_id == Match.id)
            .where(Match.tournament_id == match_obj.tournament_id)
            .where(or_(Match.team1 == team_name, Match.team2 == team_name))
        )
        res = await db.execute(stmt)
        results = res.all()

        # We also need the question metadata to know which answer is which
        q_stmt = select(CampaignQuestion).join(Campaign).where(Campaign.tournament_id == match_obj.tournament_id, Campaign.is_master == True)
        q_res = await db.execute(q_stmt)
        questions = q_res.scalars().all()

        scores = []
        potm_players = []
        winners = []

        for correct_answers, t1, t2 in results:
            if not correct_answers: continue
            for q in questions:
                val = correct_answers.get(q.id)
                if val is None: continue
                
                text = (q.question_text or "").lower()
                qtype = q.question_type
                
                # Winner
                if q.options and len(q.options) == 2 and set(q.options) == {t1, t2}:
                    if val == team_name: winners.append(val)
                # Powerplay
                elif qtype == "free_number" and "powerplay" in text:
                    if team_name.lower() in text:
                        try: scores.append(int(val))
                        except: pass
                # POTM
                elif qtype == "free_text" and ("player" in text or "potm" in text):
                    if team_name in str(val): # Rough heuristic
                        potm_players.append(val)

        avg_pp = int(sum(scores) / len(scores)) if scores else random.randint(50, 70)
        stats = {"avg_pp": avg_pp, "potm": potm_players}
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

    # 5. Persist to CampaignAnswer instead of legacy columns
    from backend.models import Campaign, CampaignQuestion, CampaignResponse, CampaignAnswer
    from sqlalchemy.orm import selectinload

    # Fetch master campaign questions
    # 1. Find master campaign for this match (via tournament)
    cam_stmt = select(Campaign).options(selectinload(Campaign.questions)).where(
        Campaign.tournament_id == match_obj.tournament_id,
        Campaign.is_master == True
    )
    cam_res = await db.execute(cam_stmt)
    master_campaign = cam_res.scalars().first()

    if not master_campaign:
        raise HTTPException(status_code=404, detail="Master campaign not found for this match")

    # Create CampaignResponse
    resp_id = str(uuid.uuid4())
    c_resp = CampaignResponse(
        id=resp_id,
        campaign_id=master_campaign.id,
        user_id=current_user.id,
        match_id=match_id
    )
    db.add(c_resp)

    generated_answers = {}
    t1, t2 = match_obj.team1, match_obj.team2

    for q in master_campaign.questions:
        opts = q.options or []
        qtype = q.question_type
        text = (q.question_text or "").lower()
        val = None

        # Identify question by metadata
        if set(opts) == {t1, t2}: # Match Winner
            val = winner
        elif qtype == "free_number":
            if t1.lower() in text or "team1" in text or "{{team1}}" in text:
                val = str(team1_pp)
            elif t2.lower() in text or "team2" in text or "{{team2}}" in text:
                val = str(team2_pp)
        elif qtype == "free_text" and ("player" in text or "potm" in text or "man of" in text):
            val = potm
        elif qtype == "dropdown" and len(opts) >= 2:
            if "six" in text: val = more_sixes_team
            elif "four" in text: val = more_fours_team
        
        if val is not None:
            generated_answers[q.id] = val
            db.add(CampaignAnswer(
                id=str(uuid.uuid4()),
                response_id=resp_id,
                question_id=q.id,
                answer_value=val
            ))

    # Persist prediction metadata
    new_pred = Prediction(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        match_id=match_id,
        use_powerup="No",
        is_auto_predicted=True,
    )
    db.add(new_pred)
    await db.commit()

    return {**generated_answers, "use_powerup": "No"}


@router.get("/{match_id}")
async def get_match(match_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(Match).options(selectinload(Match.reporter)).where(Match.id == match_id))
    m = result.scalars().first()
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")

    def replace_placeholders(text: str, m: Match) -> str:
        if not text:
            return text
        return text.replace("{{Team1}}", m.team1).replace("{{Team2}}", m.team2).replace("{{team1}}", m.team1).replace("{{team2}}", m.team2)
        
    # Fetch results from CampaignMatchResult
    from backend.models import CampaignMatchResult, Campaign, CampaignQuestion, LeagueUserMapping, League
    cmr_res = await db.execute(
        select(CampaignMatchResult)
        .join(Campaign, CampaignMatchResult.campaign_id == Campaign.id)
        .where(CampaignMatchResult.match_id == match_id, Campaign.is_master == True)
    )
    cmr = cmr_res.scalars().first()
    results_map = cmr.correct_answers if cmr else {}

    match_dict = {
        "id": m.id,
        "team1": m.team1,
        "team2": m.team2,
        "venue": m.venue,
        "tossTime": m.start_time.isoformat() if m.start_time else None,
        "start_time": m.start_time,
        "status": m.status,
        "results": results_map,
        "reported_by_name": m.reporter.name if m.reporter else None,
        "reported_by_email": m.reporter.email if m.reporter else None,
        "report_method": m.report_method,
    }
        
    # Calculate powerups used across all matches for this user
    p_result = await db.execute(
        select(Prediction)
        .where(Prediction.user_id == current_user.id)
        .where(Prediction.use_powerup == "Yes")
    )
    powerups_used = len(p_result.scalars().all())

    # Fetch Master Match Campaign
    master_result = await db.execute(
        select(Campaign)
        .options(selectinload(Campaign.questions))
        .where(Campaign.tournament_id == m.tournament_id, Campaign.is_master == True, Campaign.type == "match")
    )
    master_campaign = master_result.scalars().first()

    final_questions = []

    if master_campaign:
        for q in master_campaign.questions:
            text = replace_placeholders(q.question_text, m)
            opts = [replace_placeholders(o, m) for o in q.options] if q.options else None

            final_questions.append({
                "key": q.id,          # question_id — used for form field registration & API transport
                "question_id": q.id,
                "campaign_id": master_campaign.id,
                "question_text": text,  # label for display (placeholders already substituted)
                "answer_type": q.question_type.value if hasattr(q.question_type, 'value') else q.question_type,
                "options": opts,
                "category": "Global",
                "source_name": "IPL Global"
            })
    else:
        pass  # No master campaign for this match

    # 2. Fetch League-specific Campaign Questions
    if not current_user.is_guest:
        league_c_result = await db.execute(
            select(Campaign, League.name)
            .join(League, League.id == Campaign.league_id)
            .join(LeagueUserMapping, LeagueUserMapping.league_id == League.id)
            .options(selectinload(Campaign.questions))
            .where(League.tournament_id == m.tournament_id)
            .where(Campaign.type == "match")
            .where(Campaign.is_master == False)
            .where(LeagueUserMapping.user_id == current_user.id)
            .where(Campaign.status == "active")
            .where(or_(Campaign.match_id == m.id, Campaign.match_id == None))
        )
        league_data = league_c_result.all()
        
        for c, l_name in league_data:
            for q in c.questions:
                # Replace placeholders using the helper
                text = replace_placeholders(q.question_text, m)
                opts = None
                if q.options:
                    opts = [replace_placeholders(o, m) for o in q.options]

                final_questions.append({
                    "key": f"league_{c.id}_{q.id}",
                    "question_id": q.id,
                    "campaign_id": c.id,
                    "question_text": text,
                    "answer_type": q.question_type,
                    "options": opts,
                    "category": "League Specific",
                    "source_name": l_name,
                    "league_id": c.league_id
                })

    # Always add powerup question at the end
    final_questions.append({"key": "use_powerup", "question_text": "Use 2x Powerup for this match?", "answer_type": "text", "category": "Global", "source_name": "IPL Global"})

    return {"match": match_dict, "questions": final_questions, "powerups_used": powerups_used, "total_powerups": current_user.base_powerups}

@router.post("/{match_id}/predictions")
async def submit_prediction(match_id: str, payload: PredictionInput, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="Guests cannot submit predictions")
        
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
        
    start_time = match.start_time
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=UTC)
        
    if datetime.now(UTC) > (start_time - timedelta(minutes=30)):
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
        existing_pred.use_powerup = payload.use_powerup
    else:
        new_pred = Prediction(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            match_id=match_id,
            use_powerup=payload.use_powerup,
            is_auto_predicted=False
        )
        db.add(new_pred)

    # Unify all answers: process extra_answers into CampaignAnswer rows
    from backend.models import CampaignResponse, CampaignAnswer, CampaignQuestion

    unified_answers = dict(payload.extra_answers or {})

    # Process all answers into CampaignAnswer rows
    campaign_answers_map: Dict[str, Dict[str, Any]] = {}  # {campaign_id: {question_id: value}}
    for key, value in unified_answers.items():
        if key.startswith("league_"):
            parts = key.split("_", 2)  # ["league", campaign_id, question_id]
            if len(parts) == 3:
                c_id, q_id = parts[1], parts[2]
                campaign_answers_map.setdefault(c_id, {})[q_id] = value
        else:
            # Raw question ID — look up its campaign
            q_res = await db.execute(select(CampaignQuestion).where(CampaignQuestion.id == key))
            q_obj = q_res.scalars().first()
            if q_obj:
                campaign_answers_map.setdefault(q_obj.campaign_id, {})[key] = value

    for c_id, q_answers in campaign_answers_map.items():
        resp_stmt = select(CampaignResponse).where(
            CampaignResponse.campaign_id == c_id,
            CampaignResponse.user_id == current_user.id,
            CampaignResponse.match_id == match_id
        )
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
            ans_stmt = select(CampaignAnswer).where(
                CampaignAnswer.response_id == c_resp.id,
                CampaignAnswer.question_id == q_id
            )
            ans = (await db.execute(ans_stmt)).scalars().first()
            str_val = str(a_val) if a_val is not None else None
            if ans:
                ans.answer_value = str_val
            else:
                db.add(CampaignAnswer(
                    id=str(uuid.uuid4()),
                    response_id=c_resp.id,
                    question_id=q_id,
                    answer_value=str_val
                ))

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
        
    from backend.models import CampaignResponse, CampaignQuestion, CampaignAnswer
    from sqlalchemy.orm import selectinload
    
    # Build answers from CampaignAnswer, keyed by question_id (master) or league_{campaign_id}_{question_id} (league)
    answers = {"use_powerup": pred.use_powerup or "No", "is_auto_predicted": pred.is_auto_predicted}

    cr_result = await db.execute(
        select(CampaignResponse)
        .options(selectinload(CampaignResponse.answers), selectinload(CampaignResponse.campaign))
        .where(CampaignResponse.user_id == current_user.id, CampaignResponse.match_id == match_id)
    )
    campaign_responses = cr_result.scalars().all()

    for cr in campaign_responses:
        is_master = cr.campaign and cr.campaign.is_master
        for ans in cr.answers:
            if is_master:
                answers[ans.question_id] = ans.answer_value
            else:
                answers[f"league_{cr.campaign_id}_{ans.question_id}"] = ans.answer_value

    return answers

@router.get("/{match_id}/predictions/all")
async def get_all_community_predictions(match_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    start_time = match.start_time.replace(tzinfo=UTC) if match.start_time.tzinfo is None else match.start_time
    is_locked = datetime.now(UTC) >= (start_time - timedelta(minutes=30))
        
    from backend.models import AllowlistedEmail, CampaignResponse
    pred_result = await db.execute(
        select(Prediction, User)
        .join(User, Prediction.user_id == User.id)
        # .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .where(Prediction.match_id == match_id)
        .where(User.is_guest == False)
        # .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
    )
    
    # Fetch all campaign responses for this match
    cr_result = await db.execute(
        select(CampaignResponse)
        .options(selectinload(CampaignResponse.answers), selectinload(CampaignResponse.campaign))
        .where(CampaignResponse.match_id == match_id)
    )
    all_crs = cr_result.scalars().all()

    # Map user_id -> answers keyed by question_id (master) or league_ prefix (league)
    user_answers: dict = {}
    for cr in all_crs:
        uid = cr.user_id
        user_answers.setdefault(uid, {})
        is_master = cr.campaign and cr.campaign.is_master
        for ans in cr.answers:
            if is_master:
                user_answers[uid][ans.question_id] = ans.answer_value
            else:
                user_answers[uid][f"league_{cr.campaign_id}_{ans.question_id}"] = ans.answer_value

    all_preds_fetched = pred_result.all()
    
    # Identify user's leagues
    from backend.models import LeagueUserMapping, League
    user_leagues_res = await db.execute(
        select(League)
        .join(LeagueUserMapping)
        .where(LeagueUserMapping.user_id == current_user.id)
    )
    user_leagues = user_leagues_res.scalars().all()

    response_data = []

    def format_predictions(filter_uids=None):
        results = []
        for pred, user in all_preds_fetched:
            if filter_uids is not None and user.id not in filter_uids:
                continue
            answers = user_answers.get(user.id, {})
            # Always include use_powerup from Prediction row
            answers["use_powerup"] = pred.use_powerup

            if not is_locked:
                answers = {k: "🔒" for k in answers}
                
            results.append({
                "prediction_id": pred.id,
                "user": {"id": user.id, "name": user.name, "avatar_url": user.avatar_url},
                "answers": answers,
                "is_auto_predicted": pred.is_auto_predicted,
                "points_awarded": pred.points_awarded,
                "points_breakdown": pred.points_breakdown
            })
        return results

    if len(user_leagues) > 0:
        for league in user_leagues:
            members_res = await db.execute(
                select(User.id)
                .join(LeagueUserMapping)
                .where(LeagueUserMapping.league_id == league.id)
            )
            member_ids = set(members_res.scalars().all())
            
            response_data.append({
                "league": {"id": league.id, "name": league.name},
                "predictions": format_predictions(member_ids)
            })
    else:
        # Fallback to IPL Global if user has no leagues
        response_data.append({
            "league": {"id": "global", "name": "IPL Global"},
            "predictions": format_predictions(None)
        })

    return response_data

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
        start_time=req.start_time,
        tournament_id=req.tournament_id,
        status=MatchStatus.upcoming
    )
    db.add(new_match)
    await db.commit()
    return {"message": "Match created successfully", "id": new_match.id}
