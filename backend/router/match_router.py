import uuid
import random
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
from backend.models import (
    User, Match, MatchStatus, Tournament,
    Campaign, CampaignQuestion, CampaignResponse,
    LeagueUserMapping, League, CampaignMatchResult,
    TournamentUserMapping,
    SystemEventType,
)
from backend.utils.cache import backend_cache
from backend.utils.events import dispatch_event

router = APIRouter(prefix="/api/matches", tags=["matches"])


class PredictionInput(BaseModel):
    use_powerup: Optional[bool] = False
    # Flat dict: question_id -> value (master) or "league_{campaign_id}_{question_id}" -> value (league)
    extra_answers: Optional[Dict[str, Any]] = {}


class MatchCreate(BaseModel):
    id: str
    team1: str
    team2: str
    venue: str
    start_time: datetime
    tournament_id: str


def _replace_placeholders(text: str, match: Match) -> str:
    if not text:
        return text
    return (text
            .replace("{{Team1}}", match.team1).replace("{{team1}}", match.team1)
            .replace("{{Team2}}", match.team2).replace("{{team2}}", match.team2))


def _is_locked(match: Match) -> bool:
    start_time = match.start_time
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=UTC)
    return datetime.now(UTC) >= (start_time - timedelta(minutes=30))


# ── List Matches ──────────────────────────────────────────────────────────────

@router.get("")
async def list_matches(tournament_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = today_start + timedelta(days=3)

    query = select(Match).options(selectinload(Match.reporter))

    if tournament_id:
        query = query.where(Match.tournament_id == tournament_id)
    else:
        query = query.where(
            ((Match.start_time >= today_start) & (Match.start_time <= cutoff)) &
            ((Match.status == MatchStatus.upcoming) | (Match.status == MatchStatus.completed))
        )

    result = await db.execute(query.order_by(Match.start_time.asc()))
    matches = []
    for m in result.scalars().all():
        matches.append({
            "id": m.id,
            "team1": m.team1,
            "team2": m.team2,
            "venue": m.venue,
            "tossTime": m.start_time.isoformat() if m.start_time else None,
            "start_time": m.start_time,
            "status": m.status,
            "report_method": m.report_method,
            "reported_by_name": m.reporter.name if m.reporter else None,
            "reported_by_email": m.reporter.email if m.reporter else None,
        })
    return matches


# ── Match Detail ──────────────────────────────────────────────────────────────

async def _get_tournament_user_mapping(db: AsyncSession, tournament_id: str, user_id: str) -> TournamentUserMapping:
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
        # We don't commit here, let the caller commit if needed
    return mapping


@router.get("/{match_id}")
async def get_match(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Match).options(selectinload(Match.reporter)).where(Match.id == match_id)
    )
    m = result.scalars().first()
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")

    # Ground truth from master CampaignMatchResult
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
        "report_method": m.report_method,
        "reported_by_name": m.reporter.name if m.reporter else None,
        "reported_by_email": m.reporter.email if m.reporter else None,
    }

    # Scoped Stats
    mapping = await _get_tournament_user_mapping(db, m.tournament_id, current_user.id)
    
    # Powerups used (count of responses where use_powerup=True for this user in this tournament)
    powerups_res = await db.execute(
        select(CampaignResponse)
        .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
        .where(
            CampaignResponse.user_id == current_user.id,
            CampaignResponse.use_powerup == True,
            Campaign.tournament_id == m.tournament_id
        )
    )
    powerups_used = len(powerups_res.scalars().all())

    # ── Build question list ───────────────────────────────────────────────────
    final_questions = []

    # 1. Master campaign questions
    master_result = await db.execute(
        select(Campaign)
        .options(selectinload(Campaign.questions))
        .where(
            Campaign.tournament_id == m.tournament_id,
            Campaign.is_master == True,
            Campaign.type == "match",
        )
    )
    master_campaign = master_result.scalars().first()

    if master_campaign:
        for q in master_campaign.questions:
            text = _replace_placeholders(q.question_text, m)
            opts = [_replace_placeholders(o, m) for o in q.options] if q.options else None
            final_questions.append({
                "key": q.id,             # used as form field key and in answers dict
                "question_id": q.id,
                "slug": q.key,           # stable slug (match_winner, pp_team1, etc.)
                "campaign_id": master_campaign.id,
                "question_text": text,
                "answer_type": q.question_type.value if hasattr(q.question_type, "value") else q.question_type,
                "options": opts,
                "scoring_rules": q.scoring_rules,
                "category": "Global",
                "source_name": "IPL Global",
            })

    # 2. League-specific campaign questions
    if not current_user.is_guest:
        league_result = await db.execute(
            select(Campaign, League.name)
            .join(League, League.id == Campaign.league_id)
            .join(LeagueUserMapping, LeagueUserMapping.league_id == League.id)
            .options(selectinload(Campaign.questions))
            .where(
                League.tournament_id == m.tournament_id,
                Campaign.type == "match",
                Campaign.is_master == False,
                LeagueUserMapping.user_id == current_user.id,
                Campaign.status == "active",
                or_(Campaign.match_id == m.id, Campaign.match_id == None),
            )
        )
        for c, league_name in league_result.all():
            for q in c.questions:
                text = _replace_placeholders(q.question_text, m)
                opts = [_replace_placeholders(o, m) for o in q.options] if q.options else None
                final_questions.append({
                    "key": f"league_{c.id}_{q.id}",
                    "question_id": q.id,
                    "slug": q.key,
                    "campaign_id": c.id,
                    "question_text": text,
                    "answer_type": q.question_type.value if hasattr(q.question_type, "value") else q.question_type,
                    "options": opts,
                    "scoring_rules": q.scoring_rules,
                    "category": "League Specific",
                    "source_name": league_name,
                    "league_id": c.league_id,
                })

    # Powerup question is always last
    final_questions.append({
        "key": "use_powerup",
        "question_text": "Use 2x Powerup for this match?",
        "answer_type": "toggle",
        "category": "Global",
        "source_name": "IPL Global",
    })

    return {
        "match": match_dict,
        "questions": final_questions,
        "powerups_used": powerups_used,
        "total_powerups": mapping.base_powerups,
    }


# ── Auto-Predict ──────────────────────────────────────────────────────────────

@router.post("/{match_id}/autopredict")
async def post_autopredict(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="Guests cannot submit predictions")

    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if _is_locked(match):
        raise HTTPException(status_code=403, detail="Predictions are locked for this match")

    # Guard: only allow once per user per match
    existing = await db.execute(
        select(CampaignResponse).where(
            CampaignResponse.user_id == current_user.id,
            CampaignResponse.match_id == match_id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Prediction already exists for this match")

    # Determine winner via random weighted on simple team strength
    winner = match.team1 if random.random() > 0.5 else match.team2

    # Get stats from past raw_result_json on completed matches
    async def get_team_stats(team_name: str) -> dict:
        res = await db.execute(
            select(Match.raw_result_json, Match.team1, Match.team2).where(
                or_(Match.team1 == team_name, Match.team2 == team_name),
                Match.status == MatchStatus.completed,
                Match.raw_result_json != None,
            )
        )
        scores, potm_players = [], []
        for raw_json, t1, t2 in res.all():
            if not raw_json:
                continue
            pp = raw_json.get("team1_powerplay_score") if t1 == team_name else raw_json.get("team2_powerplay_score")
            if pp is not None:
                try:
                    scores.append(int(pp))
                except (ValueError, TypeError):
                    pass
            if raw_json.get("winner") == team_name and raw_json.get("player_of_the_match"):
                potm_players.append(raw_json["player_of_the_match"])

        avg_pp = int(sum(scores) / len(scores)) if scores else random.randint(50, 70)
        return {"avg_pp": avg_pp, "potm": potm_players}

    t1_stats = await get_team_stats(match.team1)
    t2_stats = await get_team_stats(match.team2)
    team1_pp = t1_stats["avg_pp"] + random.randint(-5, 5)
    team2_pp = t2_stats["avg_pp"] + random.randint(-5, 5)
    winner_players = (t1_stats if winner == match.team1 else t2_stats)["potm"]
    potm = random.choice(winner_players) if winner_players else f"Star Player ({winner})"

    match_number = 0
    try:
        match_number = int(match_id.split("-")[-1])
    except (ValueError, IndexError):
        pass
    more_sixes = (match.team1 if random.random() > 0.5 else match.team2) if match_number >= 39 else None
    more_fours = (match.team1 if random.random() > 0.5 else match.team2) if match_number >= 39 else None

    # Fetch master campaign questions
    cam_res = await db.execute(
        select(Campaign).options(selectinload(Campaign.questions))
        .where(Campaign.tournament_id == match.tournament_id, Campaign.is_master == True)
    )
    master_campaign = cam_res.scalars().first()
    if not master_campaign:
        raise HTTPException(status_code=404, detail="Master campaign not found for this tournament")

    # Build answers dict
    answers = {}
    t1, t2 = match.team1, match.team2
    for q in master_campaign.questions:
        opts = q.options or []
        qtype = q.question_type
        text = (q.question_text or "").lower()
        val = None

        if set(opts) == {t1, t2}:
            val = winner
        elif qtype == "free_number" and "powerplay" in text:
            if t1.lower() in text or "team1" in text or "{{team1}}" in text:
                val = str(team1_pp)
            elif t2.lower() in text or "team2" in text or "{{team2}}" in text:
                val = str(team2_pp)
        elif qtype == "free_text" and ("player" in text or "potm" in text or "man of" in text):
            val = potm
        elif qtype == "dropdown":
            if "six" in text:
                val = more_sixes
            elif "four" in text:
                val = more_fours

        if val is not None:
            answers[q.id] = val

    # Upsert CampaignResponse for master campaign
    new_resp = CampaignResponse(
        id=str(uuid.uuid4()),
        campaign_id=master_campaign.id,
        user_id=current_user.id,
        match_id=match_id,
        answers=answers,
        use_powerup=False,
        is_auto_predicted=True,
    )
    db.add(new_resp)
    await db.commit()
    backend_cache.invalidate(f"user_pred_status:{current_user.id}")

    return {**answers, "use_powerup": "No"}


# ── Submit Prediction ─────────────────────────────────────────────────────────

@router.post("/{match_id}/predictions")
async def submit_prediction(
    match_id: str,
    payload: PredictionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="Guests cannot submit predictions")

    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if _is_locked(match):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Predictions are locked for this match")

    # Check powerup limit
    use_powerup = payload.use_powerup or False
    if use_powerup:
        # Get tournament mapping for the match's tournament
        mapping = await _get_tournament_user_mapping(db, match.tournament_id, current_user.id)
        
        # Count existing responses where powerup is True (excluding current match) in this tournament
        existing_powerup_res = await db.execute(
            select(CampaignResponse)
            .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
            .where(
                CampaignResponse.user_id == current_user.id,
                CampaignResponse.use_powerup == True,
                CampaignResponse.match_id != match_id,
                Campaign.tournament_id == match.tournament_id,
            )
        )
        powerups_used = len(existing_powerup_res.scalars().all())
        if powerups_used >= mapping.base_powerups:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="powerup_limit_reached",
            )

    # Parse answers into {campaign_id: {question_id: value}}
    campaign_answers_map: Dict[str, Dict[str, Any]] = {}
    for key, value in (payload.extra_answers or {}).items():
        if key.startswith("league_"):
            parts = key.split("_", 2)  # ["league", campaign_id, question_id]
            if len(parts) == 3:
                c_id, q_id = parts[1], parts[2]
                campaign_answers_map.setdefault(c_id, {})[q_id] = value
        else:
            # Raw question_id — look up its campaign
            q_res = await db.execute(
                select(CampaignQuestion).where(CampaignQuestion.id == key)
            )
            q_obj = q_res.scalars().first()
            if q_obj:
                campaign_answers_map.setdefault(q_obj.campaign_id, {})[key] = value

    # Upsert one CampaignResponse per campaign
    for c_id, q_answers in campaign_answers_map.items():
        resp_res = await db.execute(
            select(CampaignResponse).where(
                CampaignResponse.campaign_id == c_id,
                CampaignResponse.user_id == current_user.id,
                CampaignResponse.match_id == match_id,
            )
        )
        c_resp = resp_res.scalars().first()

        # Determine if this is the master campaign (for use_powerup)
        is_master_resp = False
        if c_resp:
            # Already know if master from existing
            cam_check = await db.execute(select(Campaign.is_master).where(Campaign.id == c_id))
            is_master_resp = bool(cam_check.scalars().first())
        else:
            cam_check = await db.execute(select(Campaign.is_master).where(Campaign.id == c_id))
            is_master_resp = bool(cam_check.scalars().first())

        if c_resp:
            # Merge new answers into existing
            existing_answers = dict(c_resp.answers or {})
            existing_answers.update(q_answers)
            c_resp.answers = existing_answers
            if is_master_resp:
                c_resp.use_powerup = use_powerup
            c_resp.is_auto_predicted = False
        else:
            c_resp = CampaignResponse(
                id=str(uuid.uuid4()),
                campaign_id=c_id,
                user_id=current_user.id,
                match_id=match_id,
                answers=q_answers,
                use_powerup=use_powerup if is_master_resp else False,
                is_auto_predicted=False,
            )
            db.add(c_resp)

    await db.commit()

    # Log event
    await dispatch_event(
        db,
        event_type=SystemEventType.prediction_submitted,
        user_id=current_user.id,
        match_id=match_id,
        message=f"{current_user.name} submitted prediction for {match.team1} vs {match.team2}"
    )
    await db.commit()

    backend_cache.invalidate(f"user_pred_status:{current_user.id}")
    return {"message": "Predictions submitted successfully"}


# ── My Predictions ────────────────────────────────────────────────────────────

@router.get("/{match_id}/predictions/mine")
async def get_my_predictions(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cr_result = await db.execute(
        select(CampaignResponse)
        .options(selectinload(CampaignResponse.campaign))
        .where(CampaignResponse.user_id == current_user.id, CampaignResponse.match_id == match_id)
    )
    campaign_responses = cr_result.scalars().all()

    if not campaign_responses:
        return {}

    # Merge all answers into a flat dict
    answers: Dict[str, Any] = {}
    use_powerup = False
    is_auto_predicted = False

    for cr in campaign_responses:
        is_master = cr.campaign and cr.campaign.is_master
        for q_id, val in (cr.answers or {}).items():
            if is_master:
                answers[q_id] = val
            else:
                answers[f"league_{cr.campaign_id}_{q_id}"] = val
        if is_master:
            use_powerup = cr.use_powerup
            is_auto_predicted = cr.is_auto_predicted

    answers["use_powerup"] = "Yes" if use_powerup else "No"
    answers["is_auto_predicted"] = is_auto_predicted
    return answers


# ── Community Reveal ──────────────────────────────────────────────────────────

@router.get("/{match_id}/predictions/all")
async def get_all_community_predictions(
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalars().first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    locked = _is_locked(match)

    # Load all CampaignResponses for this match
    cr_result = await db.execute(
        select(CampaignResponse)
        .options(selectinload(CampaignResponse.campaign))
        .where(CampaignResponse.match_id == match_id)
    )
    all_crs = cr_result.scalars().all()

    # Build {user_id: {flat_answer_key: value}} and metadata
    user_answers: Dict[str, Dict] = {}
    user_meta: Dict[str, Dict] = {}  # use_powerup, is_auto_predicted, points_awarded, points_breakdown

    for cr in all_crs:
        uid = cr.user_id
        user_answers.setdefault(uid, {})
        is_master = cr.campaign and cr.campaign.is_master

        for q_id, val in (cr.answers or {}).items():
            if is_master:
                user_answers[uid][q_id] = val
            else:
                user_answers[uid][f"league_{cr.campaign_id}_{q_id}"] = val

        if is_master:
            user_meta[uid] = {
                "use_powerup": cr.use_powerup,
                "is_auto_predicted": cr.is_auto_predicted,
                "points_awarded": cr.total_points,
                "points_breakdown": cr.points_breakdown,
                "response_id": cr.id,
            }

    # Load user profiles for all users who responded
    all_user_ids = list(user_meta.keys())
    users_res = await db.execute(
        select(User).where(User.id.in_(all_user_ids), User.is_guest == False)
    )
    users_map = {u.id: u for u in users_res.scalars().all()}

    def format_prediction(uid: str) -> Optional[dict]:
        user = users_map.get(uid)
        if not user:
            return None
        meta = user_meta.get(uid, {})
        answers = user_answers.get(uid, {})
        answers["use_powerup"] = "Yes" if meta.get("use_powerup", False) else "No"

        if not locked:
            answers = {k: "🔒" for k in answers}

        return {
            "prediction_id": meta.get("response_id"),
            "user": {"id": user.id, "name": user.name, "avatar_url": user.avatar_url},
            "answers": answers,
            "is_auto_predicted": meta.get("is_auto_predicted", False),
            "points_awarded": meta.get("points_awarded"),
            "points_breakdown": meta.get("points_breakdown"),
        }

    # Segment by leagues the current user belongs to
    user_leagues_res = await db.execute(
        select(League).join(LeagueUserMapping)
        .where(LeagueUserMapping.user_id == current_user.id)
    )
    user_leagues = user_leagues_res.scalars().all()

    response_data = []

    if user_leagues:
        for league in user_leagues:
            members_res = await db.execute(
                select(User.id).join(LeagueUserMapping)
                .where(LeagueUserMapping.league_id == league.id)
            )
            member_ids = set(members_res.scalars().all())
            preds = [p for uid in member_ids if (p := format_prediction(uid)) is not None]
            response_data.append({
                "league": {"id": league.id, "name": league.name},
                "predictions": preds,
            })
    else:
        # Fallback to global
        preds = [p for uid in all_user_ids if (p := format_prediction(uid)) is not None]
        response_data.append({
            "league": {"id": "global", "name": "IPL Global"},
            "predictions": preds,
        })

    return response_data


# ── Prediction Status ─────────────────────────────────────────────────────────

@router.get("/my/prediction-status")
async def get_my_prediction_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns list of match_ids the current user has already predicted for."""
    if current_user.is_guest:
        return []

    cache_key = f"user_pred_status:{current_user.id}"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    res = await db.execute(
        select(CampaignResponse.match_id)
        .where(
            CampaignResponse.user_id == current_user.id,
            CampaignResponse.match_id != None,
        )
        .distinct()
    )
    match_ids = list(res.scalars().all())
    backend_cache.set(cache_key, match_ids)
    return match_ids


# ── Create Match (Admin) ──────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_match(
    req: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

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
        status=MatchStatus.upcoming,
    )
    db.add(new_match)
    await db.commit()

    # Log event
    await dispatch_event(
        db,
        event_type=SystemEventType.prediction_submitted,
        user_id=current_user.id,
        match_id=match_id,
        message=f"{current_user.name} submitted prediction for {match.team1} vs {match.team2}"
    )
    await db.commit()

    return {"message": "Prediction saved successfully", "id": new_match.id}
