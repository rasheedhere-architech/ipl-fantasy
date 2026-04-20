from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.models import Campaign, CampaignQuestion, CampaignResponse, CampaignAnswer, QuestionType, User


def score_answer(question: CampaignQuestion, answer_value) -> int:
    rules = question.scoring_rules or {}
    correct = question.correct_answer
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
        if diff <= 5:
            return within_range_points
        return wrong_points

    if q_type == QuestionType.multiple_choice:
        # answer_value is a list; correct is a list — must match exactly (same set)
        try:
            user_set = set(answer_value) if isinstance(answer_value, list) else {answer_value}
            correct_set = set(correct) if isinstance(correct, list) else {correct}
        except TypeError:
            return wrong_points
        return exact_points if user_set == correct_set else wrong_points

    # toggle, dropdown, free_text: string comparison
    user_str = str(answer_value).strip().lower() if answer_value is not None else ""
    correct_str = str(correct).strip().lower() if correct is not None else ""
    return exact_points if user_str == correct_str else wrong_points


async def calculate_campaign_scores(campaign_id: str, db: AsyncSession) -> None:
    campaign_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )
    campaign = campaign_result.scalars().first()
    if not campaign:
        return

    result = await db.execute(
        select(CampaignResponse)
        .where(CampaignResponse.campaign_id == campaign_id)
        .options(selectinload(CampaignResponse.answers).selectinload(CampaignAnswer.question))
    )
    responses = result.scalars().all()

    # Score submitted responses
    responded_user_ids = set()
    for response in responses:
        total = 0
        for answer in response.answers:
            pts = score_answer(answer.question, answer.answer_value)
            answer.points_awarded = pts
            total += pts
        response.total_points = total
        responded_user_ids.add(response.user_id)

    # Apply non-participation penalty: create penalty responses for users who didn't respond
    penalty = campaign.non_participation_penalty
    if penalty != 0:
        users_result = await db.execute(
            select(User).where(User.is_ai == False, User.is_guest == False)
        )
        all_users = users_result.scalars().all()
        import uuid as _uuid
        for user in all_users:
            if user.id not in responded_user_ids:
                penalty_response = CampaignResponse(
                    id=str(_uuid.uuid4()),
                    campaign_id=campaign_id,
                    user_id=user.id,
                    total_points=penalty,
                )
                db.add(penalty_response)

    await db.commit()
