import uuid as _uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.models import (
    Campaign, CampaignQuestion, CampaignResponse, CampaignAnswer, 
    QuestionType, User, CampaignMatchResult, LeagueUserMapping
)


def score_answer(question: CampaignQuestion, answer_value, correct_answer_override=None) -> int:
    rules = question.scoring_rules or {}
    # Use override if provided (from CampaignMatchResult), else fall back to question default
    correct = correct_answer_override if correct_answer_override is not None else question.correct_answer
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
        try:
            user_set = set(answer_value) if isinstance(answer_value, list) else {answer_value}
            correct_set = set(correct) if isinstance(correct, list) else {correct}
        except TypeError:
            return wrong_points

        tiers = rules.get("multiple_choice_tiers", {})
        if tiers:
            # How many of the user's answers are in the correct set?
            correct_count = len(user_set.intersection(correct_set))
            # Get points exactly from the tier, fallback to wrong_points
            return tiers.get(str(correct_count), wrong_points)

        return exact_points if user_set == correct_set else wrong_points

    # toggle, dropdown, free_text: string comparison
    user_str = str(answer_value).strip().strip('"').strip("'").lower() if answer_value is not None else ""
    correct_str = str(correct).strip().strip('"').strip("'").lower() if correct is not None else ""
    
    return exact_points if user_str == correct_str else wrong_points


async def calculate_campaign_scores(campaign_id: str, db: AsyncSession) -> None:
    campaign_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )
    campaign = campaign_result.scalars().first()
    if not campaign:
        return

    # Check for match-specific correct answer overrides
    res = await db.execute(
        select(CampaignMatchResult).where(
            CampaignMatchResult.campaign_id == campaign_id
        )
    )
    match_results = res.scalars().all()
    overrides_by_match = {mr.match_id: (mr.correct_answers or {}) for mr in match_results}
    # Also support general overrides if match_id is somehow None in the result
    general_overrides = overrides_by_match.get(None, {})

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
        
        # Determine the correct match_id context for this response
        m_id = response.match_id or campaign.match_id
        overrides = overrides_by_match.get(m_id, general_overrides)
        
        for answer in response.answers:
            # Pass the override for this question if it exists
            override = overrides.get(str(answer.question_id))
            pts = score_answer(answer.question, answer.answer_value, correct_answer_override=override)
            answer.points_awarded = pts
            total += pts
        response.total_points = total
        responded_user_ids.add(response.user_id)
        
        # PERSIST to LeaderboardEntry for match-wise progression
        if response.match_id and campaign.league_id:
            from backend.models import LeaderboardEntry
            lb_res = await db.execute(
                select(LeaderboardEntry).where(
                    LeaderboardEntry.user_id == response.user_id,
                    LeaderboardEntry.match_id == response.match_id,
                    LeaderboardEntry.league_id == campaign.league_id
                )
            )
            lb_entry = lb_res.scalars().first()
            if not lb_entry:
                lb_entry = LeaderboardEntry(
                    user_id=response.user_id,
                    match_id=response.match_id,
                    league_id=campaign.league_id,
                    points=total,
                    type="campaign"
                )
                db.add(lb_entry)
            else:
                lb_entry.points = total
                lb_entry.type = "campaign"

    # Non-participation penalty
    if campaign.non_participation_penalty != 0:
        # Get all users in this league (or global) who didn't respond
        if campaign.league_id:
            all_users_res = await db.execute(
                select(User.id).join(LeagueUserMapping, User.id == LeagueUserMapping.user_id)
                .where(LeagueUserMapping.league_id == campaign.league_id)
            )
        else:
            all_users_res = await db.execute(select(User.id))
        
        all_user_ids = [u_id for (u_id,) in all_users_res.all()]
        missing_user_ids = [uid for uid in all_user_ids if uid not in responded_user_ids]
        
        for uid in missing_user_ids:
            if campaign.match_id and campaign.league_id:
                from backend.models import LeaderboardEntry
                lb_res = await db.execute(
                    select(LeaderboardEntry).where(
                        LeaderboardEntry.user_id == uid,
                        LeaderboardEntry.match_id == campaign.match_id,
                        LeaderboardEntry.league_id == campaign.league_id
                    )
                )
                lb_entry = lb_res.scalars().first()
                if not lb_entry:
                    lb_entry = LeaderboardEntry(
                        user_id=uid,
                        match_id=campaign.match_id,
                        league_id=campaign.league_id,
                        points=campaign.non_participation_penalty,
                        type="campaign"
                    )
                    db.add(lb_entry)
                else:
                    # Don't override if they already have match points? 
                    # Actually, if they didn't respond to the campaign, we add the penalty
                    # but if they have match points from predictions, we should BE CAREFUL.
                    # LeaderboardEntry for predictions has league_id=None.
                    # So this is safe since it's league-specific.
                    lb_entry.points = campaign.non_participation_penalty

    await db.commit()
