from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional, Any
from datetime import datetime, timedelta, UTC
import csv
from io import StringIO

from backend.database import get_db
from backend.models import (
    User, Tournament, TournamentStatus, League, Match, MatchStatus,
    Campaign, CampaignStatus, TournamentMatchAnswer, TournamentQuestion,
    QuestionType
)
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

        # Robust start_time parsing
        start_time_raw = row["start_time"].strip()
        start_time = None
        
        # Try ISO first
        try:
            start_time = datetime.fromisoformat(start_time_raw.replace("Z", "+00:00"))
        except ValueError:
            # Try the IST format commonly used in manual sheets: 22-Mar-26 07:30 PM
            try:
                dt_ist = datetime.strptime(start_time_raw, "%d-%b-%y %I:%M %p")
                # Convert IST to UTC (subtract 5.5 hours)
                start_time = (dt_ist - timedelta(hours=5, minutes=30)).replace(tzinfo=UTC)
            except ValueError:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid date format for match {match_id}. Use ISO (2026-03-22T19:30:00Z) or IST (22-Mar-26 07:30 PM)"
                )

        new_match = Match(
            id=match_id,
            external_id=row.get("external_id", match_id),
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


# ── Tournament Question Bank ─────────────────────────────────────────────────

@router.get("/{tournament_id}/question-bank")
async def get_tournament_question_bank(
    tournament_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the master bank of questions for a tournament.
    Admins pick from these to build the master campaign.
    League admins pick from these to build league match campaigns.
    """
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalars().first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    questions_res = await db.execute(
        select(TournamentQuestion).where(TournamentQuestion.tournament_id == tournament_id).order_by(TournamentQuestion.order_index)
    )
    questions = questions_res.scalars().all()

    return {
        "tournament_id": tournament_id,
        "questions": [
            {
                "id": q.id,
                "key": q.key,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options,
                "default_scoring_rules": q.default_scoring_rules,
                "order_index": q.order_index,
                "allow_powerup": q.allow_powerup,
            }
            for q in questions
        ],
    }


class TournamentQuestionCreate(BaseModel):
    key: str
    question_text: str
    question_type: QuestionType
    options: Optional[list[str]] = None
    default_scoring_rules: dict
    order_index: int = 0
    allow_powerup: bool = True

@router.post("/{tournament_id}/question-bank", status_code=status.HTTP_201_CREATED)
async def add_tournament_question(
    tournament_id: str,
    payload: TournamentQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalars().first()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    import uuid
    tq = TournamentQuestion(
        id=str(uuid.uuid4()),
        tournament_id=tournament_id,
        key=payload.key,
        question_text=payload.question_text,
        question_type=payload.question_type,
        options=payload.options,
        default_scoring_rules=payload.default_scoring_rules,
        order_index=payload.order_index,
        allow_powerup=payload.allow_powerup,
    )
    db.add(tq)
    await db.commit()
    return {"message": "Question added to bank", "id": tq.id}

@router.delete("/{tournament_id}/question-bank/{question_id}", status_code=status.HTTP_200_OK)
async def delete_tournament_question(
    tournament_id: str,
    question_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    q_res = await db.execute(select(TournamentQuestion).where(TournamentQuestion.id == question_id, TournamentQuestion.tournament_id == tournament_id))
    q = q_res.scalars().first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    from backend.models import Campaign, CampaignQuestion
    used_res = await db.execute(
        select(CampaignQuestion).join(Campaign).where(
            Campaign.tournament_id == tournament_id,
            CampaignQuestion.key == q.key
        ).limit(1)
    )
    if used_res.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete this question because it is being used in one or more match campaigns.")

    await db.delete(q)
    await db.commit()
    return {"message": "Question deleted"}


@router.put("/{tournament_id}/question-bank/{question_id}", status_code=status.HTTP_200_OK)
async def update_tournament_question(
    tournament_id: str,
    question_id: str,
    payload: TournamentQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    q_res = await db.execute(select(TournamentQuestion).where(TournamentQuestion.id == question_id, TournamentQuestion.tournament_id == tournament_id))
    q = q_res.scalars().first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    # Check if used
    from backend.models import Campaign, CampaignQuestion
    used_res = await db.execute(
        select(CampaignQuestion).join(Campaign).where(
            Campaign.tournament_id == tournament_id,
            CampaignQuestion.key == q.key
        ).limit(1)
    )
    is_used = used_res.scalars().first() is not None

    if is_used and q.key != payload.key:
         raise HTTPException(status_code=400, detail="Cannot change the key of a question that is already in use.")

    q.key = payload.key
    q.question_text = payload.question_text
    q.question_type = payload.question_type
    q.options = payload.options
    q.default_scoring_rules = payload.default_scoring_rules
    q.order_index = payload.order_index
    q.allow_powerup = payload.allow_powerup

    await db.commit()
    return {"message": "Question updated", "id": q.id}


# ── Tournament Match Answers (Admin) ─────────────────────────────────────────

class TournamentMatchAnswerPayload(BaseModel):
    correct_answers: dict[str, Any]  # {question_key: answer_value}


@router.get("/{tournament_id}/matches/{match_id}/answers")
async def get_tournament_match_answers(
    tournament_id: str,
    match_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the admin-set correct answers for a match in this tournament."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    row = await db.get(TournamentMatchAnswer, (tournament_id, match_id))
    return {
        "tournament_id": tournament_id,
        "match_id": match_id,
        "correct_answers": row.correct_answers if row else {},
    }


@router.put("/{tournament_id}/matches/{match_id}/answers")
async def set_tournament_match_answers(
    tournament_id: str,
    match_id: str,
    payload: TournamentMatchAnswerPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin sets correct answers for a match (keyed by question.key).
    This single call triggers scoring for ALL match campaigns in this tournament
    (master campaign + every league campaign) that belong to this match.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Verify tournament + match exist
    tournament = await db.get(Tournament, tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    match = await db.get(Match, match_id)
    if not match or match.tournament_id != tournament_id:
        raise HTTPException(status_code=404, detail="Match not found in this tournament")

    # Upsert TournamentMatchAnswer
    row = await db.get(TournamentMatchAnswer, (tournament_id, match_id))
    if row:
        row.correct_answers = payload.correct_answers
    else:
        row = TournamentMatchAnswer(
            tournament_id=tournament_id,
            match_id=match_id,
            correct_answers=payload.correct_answers,
        )
        db.add(row)
    await db.flush()

    # Score ALL match campaigns in this tournament that are linked to this match
    from backend.models import CampaignType, CampaignStatus as CS
    from backend.campaigns_scoring import calculate_campaign_scores
    campaigns_res = await db.execute(
        select(Campaign).where(
            Campaign.tournament_id == tournament_id,
            Campaign.match_id == match_id,
            Campaign.type == CampaignType.match,
            Campaign.status == CS.active,
        )
    )
    campaigns = campaigns_res.scalars().all()
    for campaign in campaigns:
        await calculate_campaign_scores(campaign.id, db)

    # Also update leaderboard cache
    from backend.scoring import update_leaderboard_cache
    await update_leaderboard_cache(db, tournament_id)

    return {
        "message": f"Answers saved. Scored {len(campaigns)} campaign(s).",
        "campaigns_scored": [c.id for c in campaigns],
    }

