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
        Fetch the final results for the following IPL match:
        Teams: {match.team1} vs {match.team2}
        Venue: {match.venue}
        Date: {match.toss_time.strftime('%Y-%m-%d')}

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

        # Update the match record
        match.winner = result_data.get("winner")
        match.player_of_the_match = result_data.get("player_of_the_match")
        match.team1_powerplay_score = result_data.get("team1_powerplay_score")
        match.team2_powerplay_score = result_data.get("team2_powerplay_score")
        match.more_sixes_team = result_data.get("more_sixes_team")
        match.more_fours_team = result_data.get("more_fours_team")
        match.status = MatchStatus.completed
        match.report_method = "agent"
        
        # Store the raw JSON for audit
        match.raw_result_json = result_data
        
        await db.commit()
        return result_data

match_result_agent = MatchResultAgent()
