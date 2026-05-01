import uuid
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.database import get_db
from backend.models import (
    Campaign, CampaignQuestion, CampaignResponse,
    CampaignStatus, CampaignType, QuestionType, User, LeagueAdminMapping
)
from backend.dependencies import get_current_user
from backend.campaigns_scoring import calculate_campaign_scores
from backend.utils.cache import backend_cache
from backend.utils.permissions import check_campaign_permission, is_league_admin as _is_league_admin

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


class ScoringRulesSchema(BaseModel):
    exact_match_points: int = 0
    wrong_answer_points: int = 0
    within_range_points: int = 0  # only used for free_number
    max_selections: Optional[int] = None
    multiple_choice_tiers: Optional[dict[str, int]] = None


class QuestionCreate(BaseModel):
    id: Optional[str] = None  # set when preserving an existing question (e.g. mandatory)
    question_text: str
    question_type: QuestionType
    options: Optional[list[str]] = None
    correct_answer: Optional[Any] = None
    scoring_rules: ScoringRulesSchema
    order_index: int = 0
    is_mandatory: bool = False
    allow_powerup: bool = True


class CampaignCreate(BaseModel):
    title: str
    description: Optional[str] = None
    type: CampaignType = CampaignType.general
    is_master: bool = False
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    non_participation_penalty: int = 0
    league_id: Optional[str] = None
    match_id: Optional[str] = None
    tournament_id: Optional[str] = None
    questions: list[QuestionCreate] = []


class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    non_participation_penalty: Optional[int] = None
    league_id: Optional[str] = None
    match_id: Optional[str] = None
    tournament_id: Optional[str] = None
    questions: Optional[list[QuestionCreate]] = None


class CampaignStatusUpdate(BaseModel):
    status: CampaignStatus


class AnswerSubmit(BaseModel):
    question_id: str
    answer_value: Any


class CampaignResponseSubmit(BaseModel):
    answers: list[AnswerSubmit]


def _validate_question(q: QuestionCreate):
    if q.question_type == QuestionType.toggle:
        if not q.options or len(q.options) != 2:
            raise HTTPException(status_code=400, detail=f"Toggle question must have exactly 2 options")
    if q.question_type in (QuestionType.multiple_choice, QuestionType.dropdown):
        if not q.options or len(q.options) < 2:
            raise HTTPException(status_code=400, detail=f"{q.question_type} question must have at least 2 options")
    if q.question_type == QuestionType.free_text and q.correct_answer is not None:
        text = str(q.correct_answer)
        if not re.match(r'^[a-zA-Z ]*$', text):
            raise HTTPException(status_code=400, detail="free_text correct answer must contain only letters and spaces")


def _serialize_campaign(campaign: Campaign, my_response: CampaignResponse | None = None) -> dict:
    questions = [
        {
            "id": q.id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "scoring_rules": q.scoring_rules,
            "order_index": q.order_index,
            "is_mandatory": q.is_mandatory,
            # Only expose correct_answer if campaign is closed
            "correct_answer": q.correct_answer if campaign.status == CampaignStatus.closed else None,
        }
        for q in campaign.questions
    ]
    result = {
        "id": campaign.id,
        "title": campaign.title,
        "description": campaign.description,
        "type": campaign.type,
        "is_master": campaign.is_master,
        "status": campaign.status,
        "starts_at": campaign.starts_at,
        "ends_at": campaign.ends_at,
        "non_participation_penalty": campaign.non_participation_penalty,
        "league_id": campaign.league_id,
        "match_id": campaign.match_id,
        "tournament_id": campaign.tournament_id,
        "created_at": campaign.created_at,
        "updated_at": campaign.updated_at,
        "questions": questions,
    }
    if my_response is not None:
        answers_map = {a.question_id: {"answer_value": a.answer_value, "points_awarded": a.points_awarded} for a in my_response.answers}
        result["my_response"] = {
            "id": my_response.id,
            "total_points": my_response.total_points,
            "submitted_at": my_response.submitted_at,
            "answers": answers_map,
        }
    return result


def _serialize_campaign_admin(campaign: Campaign) -> dict:
    """Admin view: always includes correct answers."""
    questions = [
        {
            "id": q.id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "scoring_rules": q.scoring_rules,
            "order_index": q.order_index,
            "is_mandatory": q.is_mandatory,
            "allow_powerup": q.allow_powerup,
        }
        for q in campaign.questions
    ]
    return {
        "id": campaign.id,
        "title": campaign.title,
        "description": campaign.description,
        "type": campaign.type,
        "is_master": campaign.is_master,
        "status": campaign.status,
        "created_by": campaign.created_by,
        "starts_at": campaign.starts_at,
        "ends_at": campaign.ends_at,
        "non_participation_penalty": campaign.non_participation_penalty,
        "league_id": campaign.league_id,
        "match_id": campaign.match_id,
        "tournament_id": campaign.tournament_id,
        "created_at": campaign.created_at,
        "updated_at": campaign.updated_at,
        "questions": questions,
    }


# Re-using check_campaign_permission and _is_league_admin from utils.permissions
_check_campaign_permission = check_campaign_permission

# ── Admin endpoints ─────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.is_master and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only global admins can create master campaigns")
    if not payload.is_master and payload.league_id:
        if not current_user.is_admin and not await _is_league_admin(db, current_user.id, payload.league_id):
            raise HTTPException(status_code=403, detail="Not an admin for this league")
    elif not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Global campaigns require global admin privileges")
    for q in payload.questions:
        _validate_question(q)

    if payload.is_master and payload.type != CampaignType.match:
        raise HTTPException(status_code=400, detail="Only Match campaigns can be marked as master templates")

    if payload.type != CampaignType.match and any(q.is_mandatory for q in payload.questions):
        raise HTTPException(status_code=400, detail="Only Match campaigns can have mandatory questions")

    if payload.is_master and not payload.tournament_id:
        raise HTTPException(status_code=400, detail="Master campaigns must be associated with a tournament")

    campaign = Campaign(
        id=str(uuid.uuid4()),
        title=payload.title,
        description=payload.description,
        type=payload.type,
        is_master=payload.is_master,
        status=CampaignStatus.draft,
        created_by=current_user.id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        non_participation_penalty=payload.non_participation_penalty,
        league_id=payload.league_id,
        match_id=payload.match_id,
        tournament_id=payload.tournament_id,
    )
    db.add(campaign)
    await db.flush()

    # In a master campaign, every question is mandatory by definition
    force_mandatory = payload.is_master

    for q in payload.questions:
        cq = CampaignQuestion(
            id=str(uuid.uuid4()),
            campaign_id=campaign.id,
            question_text=q.question_text,
            question_type=q.question_type,
            options=q.options,
            correct_answer=q.correct_answer,
            scoring_rules=q.scoring_rules.model_dump(),
            order_index=q.order_index,
            is_mandatory=True if force_mandatory else q.is_mandatory,
            allow_powerup=q.allow_powerup,
        )
        db.add(cq)

    await db.commit()
    backend_cache.invalidate("campaigns_list")
    return {"id": campaign.id, "message": "Campaign created"}


@router.put("/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    payload: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
        .options(selectinload(Campaign.questions))
    )
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    fields_set = payload.model_fields_set
    if "title" in fields_set and payload.title is not None:
        campaign.title = payload.title
    if "description" in fields_set:
        campaign.description = payload.description
    if "starts_at" in fields_set:
        campaign.starts_at = payload.starts_at
    if "ends_at" in fields_set:
        campaign.ends_at = payload.ends_at
    if "non_participation_penalty" in fields_set and payload.non_participation_penalty is not None:
        campaign.non_participation_penalty = payload.non_participation_penalty
    if "league_id" in fields_set:
        campaign.league_id = payload.league_id
    if "match_id" in fields_set:
        campaign.match_id = payload.match_id
    if "tournament_id" in fields_set:
        campaign.tournament_id = payload.tournament_id

    if payload.questions is not None:
        for q in payload.questions:
            _validate_question(q)

        existing_by_id = {q.id: q for q in campaign.questions}
        mandatory_ids = {qid for qid, q in existing_by_id.items() if q.is_mandatory}
        payload_ids = {q.id for q in payload.questions if q.id}

        # Enforce: every existing mandatory question must appear in the payload
        missing_mandatory = mandatory_ids - payload_ids
        if missing_mandatory:
            raise HTTPException(status_code=400, detail=f"Cannot remove mandatory questions: {missing_mandatory}")

        # Sync questions
        new_questions = []
        for q in payload.questions:
            if q.id and q.id in existing_by_id:
                cq = existing_by_id[q.id]
                cq.question_text = q.question_text
                cq.question_type = q.question_type
                cq.options = q.options
                cq.correct_answer = q.correct_answer
                cq.scoring_rules = q.scoring_rules.model_dump()
                cq.order_index = q.order_index
                cq.is_mandatory = q.is_mandatory
                cq.allow_powerup = q.allow_powerup
                new_questions.append(cq)
            else:
                new_cq = CampaignQuestion(
                    id=str(uuid.uuid4()),
                    campaign_id=campaign.id,
                    question_text=q.question_text,
                    question_type=q.question_type,
                    options=q.options,
                    correct_answer=q.correct_answer,
                    scoring_rules=q.scoring_rules.model_dump(),
                    order_index=q.order_index,
                    is_mandatory=q.is_mandatory,
                    allow_powerup=q.allow_powerup,
                )
                db.add(new_cq)
                new_questions.append(new_cq)

        # Delete removed questions
        for q in campaign.questions:
            if q not in new_questions:
                await db.delete(q)

        campaign.questions = new_questions

    await db.commit()
    backend_cache.invalidate("campaigns_list")
    backend_cache.invalidate(f"campaign_{campaign_id}")
    return {"message": "Campaign updated"}


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await _check_campaign_permission(db, campaign, current_user)
    await db.delete(campaign)
    await db.commit()
    backend_cache.invalidate("campaigns_list")
    backend_cache.invalidate(f"campaign_{campaign_id}")
    return {"message": "Campaign deleted"}


@router.put("/{campaign_id}/status")
async def update_campaign_status(
    campaign_id: str,
    payload: CampaignStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await _check_campaign_permission(db, campaign, current_user)
    campaign.status = payload.status
    await db.commit()
    backend_cache.invalidate("campaigns_list")
    backend_cache.invalidate(f"campaign_{campaign_id}")
    return {"message": f"Campaign status updated to {payload.status}"}


@router.post("/{campaign_id}/calculate-scores")
async def trigger_campaign_scoring(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    await _check_campaign_permission(db, campaign, current_user)

    await calculate_campaign_scores(campaign_id, db)
    backend_cache.invalidate(f"campaign_{campaign_id}")
    return {"message": "Scoring complete"}


@router.get("/admin/all")
async def admin_list_campaigns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).options(selectinload(Campaign.questions))
        .order_by(Campaign.created_at.desc())
    )
    campaigns = result.scalars().all()
    
    if not current_user.is_admin:
        # Filter to only campaigns for leagues they manage
        # Find leagues they manage
        leagues_res = await db.execute(select(LeagueAdminMapping.league_id).where(LeagueAdminMapping.user_id == current_user.id))
        managed_leagues = {r for r in leagues_res.scalars().all()}
        campaigns = [c for c in campaigns if c.league_id and c.league_id in managed_leagues]
        
    return [_serialize_campaign_admin(c) for c in campaigns]


@router.get("/admin/{campaign_id}")
async def admin_get_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
        .options(selectinload(Campaign.questions))
    )
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    # Anyone who is an admin of the league or global admin or if it's a master campaign
    if not current_user.is_admin and not campaign.is_master:
        if not campaign.league_id or not await _is_league_admin(db, current_user.id, campaign.league_id):
            raise HTTPException(status_code=403, detail="Not authorized to view this campaign")

    return _serialize_campaign_admin(campaign)


@router.get("/admin/{campaign_id}/responses")
async def admin_get_campaign_responses(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify permission first
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not current_user.is_admin and not campaign.is_master:
        if not campaign.league_id or not await _is_league_admin(db, current_user.id, campaign.league_id):
            raise HTTPException(status_code=403, detail="Not authorized")
    result = await db.execute(
        select(CampaignResponse, User.name, User.email)
        .join(User, CampaignResponse.user_id == User.id)
        .where(CampaignResponse.campaign_id == campaign_id)
        .options(selectinload(CampaignResponse.answers))
        .order_by(CampaignResponse.total_points.desc().nullslast(), CampaignResponse.submitted_at)
    )
    rows = result.all()
    results = []
    for response, name, email in rows:
        results.append({
            "id": response.id,
            "user_name": name,
            "user_email": email,
            "total_points": response.total_points,
            "submitted_at": response.submitted_at,
            "answers": [
                {
                    "question_id": a.question_id,
                    "answer_value": a.answer_value,
                    "points_awarded": a.points_awarded,
                }
                for a in response.answers
            ]
        })
    return results


# ── User endpoints ──────────────────────────────────────────────────────────

@router.get("")
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find leagues user is part of
    from backend.models import LeagueUserMapping
    leagues_res = await db.execute(select(LeagueUserMapping.league_id).where(LeagueUserMapping.user_id == current_user.id))
    user_leagues = {r for r in leagues_res.scalars().all()}

    # Only show active/closed campaigns. Exclude drafts.
    # Also filter by league_id: show if league_id is None OR user is in that league
    stmt = select(Campaign).where(Campaign.status != CampaignStatus.draft)
    
    result = await db.execute(
        stmt.options(selectinload(Campaign.questions))
        .order_by(Campaign.ends_at.desc().nullslast(), Campaign.created_at.desc())
    )
    campaigns = result.scalars().all()
    
    # Filter in memory (or could be in SQL)
    campaigns = [c for c in campaigns if c.league_id is None or c.league_id in user_leagues]

    # Pre-fetch user's responses for all these campaigns
    campaign_ids = [c.id for c in campaigns]
    if not campaign_ids:
        return []

    resp_result = await db.execute(
        select(CampaignResponse)
        .where(CampaignResponse.campaign_id.in_(campaign_ids), CampaignResponse.user_id == current_user.id)
        .options(selectinload(CampaignResponse.answers))
    )
    responses_map = {r.campaign_id: r for r in resp_result.scalars().all()}
    
    return [_serialize_campaign(c, responses_map.get(c.id)) for c in campaigns]


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
        .options(selectinload(Campaign.questions))
    )
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == CampaignStatus.draft:
        raise HTTPException(status_code=403, detail="Campaign not available")

    # Fetch user's existing response
    resp_result = await db.execute(
        select(CampaignResponse)
        .where(CampaignResponse.campaign_id == campaign_id, CampaignResponse.user_id == current_user.id)
    )
    my_response = resp_result.scalars().first()
    return _serialize_campaign(campaign, my_response)


@router.post("/{campaign_id}/respond", status_code=status.HTTP_201_CREATED)
async def submit_response(
    campaign_id: str,
    payload: CampaignResponseSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
        .options(selectinload(Campaign.questions))
    )
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.active:
        raise HTTPException(status_code=400, detail="Campaign is not accepting responses")

    from datetime import datetime, UTC as _UTC
    now = datetime.now(_UTC)
    if campaign.starts_at and now < campaign.starts_at:
        raise HTTPException(status_code=400, detail="Campaign has not started yet")
    if campaign.ends_at and now > campaign.ends_at:
        raise HTTPException(status_code=400, detail="Campaign submission window has closed")

    existing_result = await db.execute(
        select(CampaignResponse)
        .where(CampaignResponse.campaign_id == campaign_id, CampaignResponse.user_id == current_user.id)
    )
    existing_response = existing_result.scalars().first()

    questions_map = {q.id: q for q in campaign.questions}

    # Validate all required questions answered
    answered_ids = {a.question_id for a in payload.answers}
    required_ids = {q.id for q in campaign.questions}
    missing = required_ids - answered_ids
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing answers for {len(missing)} question(s)")

    # Validate answer values and collect them
    new_answers = {}
    import re
    for answer in payload.answers:
        q = questions_map.get(answer.question_id)
        if not q:
            raise HTTPException(status_code=400, detail=f"Unknown question id: {answer.question_id}")
        if q.question_type == QuestionType.free_text:
            if not isinstance(answer.answer_value, str) or not re.match(r'^[a-zA-Z ]*$', answer.answer_value):
                raise HTTPException(status_code=400, detail="free_text answer must contain only letters and spaces")
        if q.question_type == QuestionType.free_number:
            try:
                float(answer.answer_value)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="free_number answer must be a number")
        if q.question_type in (QuestionType.toggle, QuestionType.dropdown):
            if q.options and answer.answer_value not in q.options:
                raise HTTPException(status_code=400, detail=f"Invalid option for question")
        if q.question_type == QuestionType.multiple_choice:
            if not isinstance(answer.answer_value, list):
                raise HTTPException(status_code=400, detail="multiple_choice answer must be a list")
            max_sel = q.scoring_rules.get("max_selections")
            if max_sel and len(answer.answer_value) != max_sel:
                raise HTTPException(status_code=400, detail=f"You must select exactly {max_sel} options")
            if q.options:
                for v in answer.answer_value:
                    if v not in q.options:
                        raise HTTPException(status_code=400, detail=f"Invalid option in multiple_choice answer")
        new_answers[answer.question_id] = answer.answer_value

    if existing_response:
        response = existing_response
        response.submitted_at = now
        response.answers = new_answers
    else:
        response = CampaignResponse(
            id=str(uuid.uuid4()),
            campaign_id=campaign_id,
            user_id=current_user.id,
            answers=new_answers
        )
        db.add(response)

    await db.commit()
    backend_cache.invalidate("campaigns_list")
    backend_cache.invalidate(f"campaign_{campaign_id}")
    return {"message": "Response submitted", "response_id": response.id}
