import json
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models import Match, MatchStatus
from .gemini_client import gemini_client

class MatchResultAgent:
    @staticmethod
    async def fetch_match_results(match_id: str, db: AsyncSession):
        """
        Fetches match results using Gemini after a match is completed.
        """
        # Get match details
        result = await db.execute(select(Match).where(Match.id == match_id))
        match = result.scalars().first()
        if not match:
            print(f"Match {match_id} not found.")
            return None

        prompt = f"""
        Fetch the final results for the following IPL 2026 match using the provided Google Search tool:
        Teams: {match.team1} vs {match.team2}
        Venue: {match.venue}
        Date: {match.start_time.strftime('%Y-%m-%d')}

        IMPORTANT: Use the Google Search tool to verify the ACTUAL results for this match in 2026.

        Provide the following specific data points:
        1. Winner (Team name)
        2. Player of the Match
        3. Powerplay score for {match.team1}
        4. Powerplay score for {match.team2}
        5. Team with more sixes (or 'Tie')
        6. Team with more fours (or 'Tie')

        Return the data strictly in the following JSON format:
        {{
            "winner": "...",
            "player_of_the_match": "...",
            "team1_powerplay_score": 0,
            "team2_powerplay_score": 0,
            "more_sixes_team": "...",
            "more_fours_team": "..."
        }}
        """

        result_data = await gemini_client.generate_structured_json(prompt)
        
        if not result_data:
            print(f"Failed to fetch results for match {match_id}")
            return None

        # Update the match record — all result data lives in raw_result_json
        match.raw_result_json = result_data
        match.status = MatchStatus.completed
        match.report_method = "agent"
        
        # Store the raw JSON for audit
        match.raw_result_json = result_data
        
        await db.commit()
        return result_data

match_result_agent = MatchResultAgent()
