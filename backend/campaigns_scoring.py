"""
Campaign-specific scoring engine.
Scores CampaignResponse.answers (JSON) against CampaignMatchResult.correct_answers.
Updates total_points and persists LeaderboardEntry rows for league-scoped campaigns.
"""
import uuid as _uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.models import (
    Campaign, CampaignQuestion, CampaignResponse,
    QuestionType, User, CampaignMatchResult, LeagueUserMapping, LeaderboardEntry
)


def score_answer(question: CampaignQuestion, answer_value, correct_answer_override=None) -> int:
    """
    Score a single answer against a question's scoring rules.
    correct_answer_override comes from CampaignMatchResult.correct_answers.
    """
    rules = question.scoring_rules or {}
    correct = correct_answer_override if correct_answer_override is not None else None
    q_type = question.question_type

    if correct is None:
        return 0

    exact_points = rules.get("exact_match_points", 0)
    wrong_points = rules.get("wrong_answer_points", 0)

    if q_type == QuestionType.free_number:
        within_range_points = rules.get("within_range_points", 0)
        try:
            user_val = float(answer_value)
            correct_val = float(correct)
        except (TypeError, ValueError):
            return wrong_points
        diff = abs(user_val - correct_val)
        if diff == 0:
            return exact_points
        if diff <= rules.get("range_delta", 5):
            return within_range_points
        return wrong_points

    if q_type == QuestionType.multiple_choice:
        try:
            user_set = set(answer_value) if isinstance(answer_value, list) else {answer_value}
            correct_set = set(correct) if isinstance(correct, list) else {correct}
        except TypeError:
            return wrong_points

        tiers = rules.get("multiple_choice_tiers", {})
        if tiers:
            correct_count = len(user_set.intersection(correct_set))
            return tiers.get(str(correct_count), wrong_points)

        return exact_points if user_set == correct_set else wrong_points

    # toggle, dropdown, free_text: string comparison
    user_str = str(answer_value).strip().strip('"').strip("'").lower() if answer_value is not None else ""
    correct_str = str(correct).strip().strip('"').strip("'").lower() if correct is not None else ""

    return exact_points if user_str == correct_str else wrong_points


async def calculate_campaign_scores(campaign_id: str, db: AsyncSession) -> None:
    """
    Score all CampaignResponses for a campaign.
    - Reads answers from CampaignResponse.answers (JSON dict)
    - Reads correct answers from CampaignMatchResult.correct_answers
    - Writes total_points back to CampaignResponse
    - Upserts LeaderboardEntry for league-scoped campaigns
    - Applies non_participation_penalty for missing respondents
    """
    campaign_result = await db.execute(
        select(Campaign)
        .options(selectinload(Campaign.questions))
        .where(Campaign.id == campaign_id)
    )
    campaign = campaign_result.scalars().first()
    if not campaign:
        return

    # Load correct answer overrides from CampaignMatchResult
    cmr_res = await db.execute(
        select(CampaignMatchResult).where(CampaignMatchResult.campaign_id == campaign_id)
    )
    match_results = cmr_res.scalars().all()
    overrides_by_match = {mr.match_id: (mr.correct_answers or {}) for mr in match_results}
    general_overrides = overrides_by_match.get(None, {})

    # Build question map for fast lookup
    question_map = {q.id: q for q in campaign.questions}

    # Load all responses
    resp_result = await db.execute(
        select(CampaignResponse).where(CampaignResponse.campaign_id == campaign_id)
    )
    responses = resp_result.scalars().all()

    responded_user_ids = set()

    for response in responses:
        answers = response.answers or {}  # {question_id: answer_value}
        m_id = response.match_id or campaign.match_id
        overrides = overrides_by_match.get(m_id, general_overrides)

        total = 0
        breakdown_rules = []

        for q_id, q in question_map.items():
            answer_value = answers.get(q_id)
            override = overrides.get(q_id)
            if override is None:
                continue  # No correct answer set yet for this question

            pts = score_answer(q, answer_value, correct_answer_override=override)
            total += pts
            breakdown_rules.append({
                "category": q.question_text,
                "key": q.key,
                "points": pts,
                "predicted": answer_value,
                "actual": override,
            })

        response.total_points = total
        response.points_breakdown = {"rules": breakdown_rules, "total": total}
        responded_user_ids.add(response.user_id)

        # Persist to LeaderboardEntry for league-scoped campaigns
        if response.match_id and campaign.league_id:
            lb_res = await db.execute(
                select(LeaderboardEntry).where(
                    LeaderboardEntry.user_id == response.user_id,
                    LeaderboardEntry.match_id == response.match_id,
                    LeaderboardEntry.league_id == campaign.league_id,
                )
            )
            lb_entry = lb_res.scalars().first()
            if lb_entry:
                lb_entry.points = total
                lb_entry.points_breakdown = response.points_breakdown
            else:
                db.add(LeaderboardEntry(
                    id=str(_uuid.uuid4()),
                    user_id=response.user_id,
                    match_id=response.match_id,
                    league_id=campaign.league_id,
                    points=total,
                    points_breakdown=response.points_breakdown,
                ))

    # ── Non-participation penalty ─────────────────────────────────────────────
    if campaign.non_participation_penalty != 0:
        if campaign.league_id:
            all_users_res = await db.execute(
                select(User.id).join(LeagueUserMapping, User.id == LeagueUserMapping.user_id)
                .where(LeagueUserMapping.league_id == campaign.league_id, User.is_guest == False)
            )
        else:
            all_users_res = await db.execute(select(User.id).where(User.is_guest == False))

        all_user_ids = [u_id for (u_id,) in all_users_res.all()]
        missing_user_ids = [uid for uid in all_user_ids if uid not in responded_user_ids]

        for uid in missing_user_ids:
            if campaign.match_id and campaign.league_id:
                lb_res = await db.execute(
                    select(LeaderboardEntry).where(
                        LeaderboardEntry.user_id == uid,
                        LeaderboardEntry.match_id == campaign.match_id,
                        LeaderboardEntry.league_id == campaign.league_id,
                    )
                )
                lb_entry = lb_res.scalars().first()
                if lb_entry:
                    lb_entry.points = campaign.non_participation_penalty
                else:
                    db.add(LeaderboardEntry(
                        id=str(_uuid.uuid4()),
                        user_id=uid,
                        match_id=campaign.match_id,
                        league_id=campaign.league_id,
                        points=campaign.non_participation_penalty,
                        points_breakdown=None,
                    ))

    await db.commit()
