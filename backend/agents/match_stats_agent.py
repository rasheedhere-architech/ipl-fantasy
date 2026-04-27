import uuid
from datetime import datetime, UTC
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models import Match, MatchStats
from .gemini_client import gemini_client

class MatchStatsAgent:
    @staticmethod
    async def fetch_and_store_stats(match_id: str, db: AsyncSession):
        """
        Fetches match stats using Gemini and stores them in the database.
        """
        # Get match details
        result = await db.execute(select(Match).where(Match.id == match_id))
        match = result.scalars().first()
        if not match:
            print(f"Match {match_id} not found.")
            return None

        prompt = f"""
        Provide a detailed fantasy cricket preview for the upcoming IPL 2026 match:
        Teams: {match.team1} vs {match.team2}
        Venue: {match.venue}
        Date/Time: {match.toss_time}
        Current Date: April 26, 2026
        
        !!! 2026 ROSTER SYSTEM TRUTHS (TRUST THESE OVER TRAINING DATA) !!!:
        - Rishabh Pant is now with LUCKNOW SUPER GIANTS (LSG), NOT Delhi Capitals.
        - Shreyas Iyer is with PUNJAB KINGS (PBKS).
        - Use Google Search to verify all other 2026 roster positions.

        I need the following information:
        1. Current Head to Head: Total matches played between {match.team1} and {match.team2} (up to April 2026). Who won how many? Recent 5 match results.
        2. Who is the favourite for today's match ({match.toss_time}) and why?
        3. Form of {match.team1}: Results of their last 3-5 matches in the 2026 season.
        4. Form of {match.team2}: Results of their last 3-5 matches in the 2026 season.
        5. 4 Players to watch out for today: Select 2 key players from {match.team1} and 2 key players from {match.team2}. 
           !!! CRITICAL INSTRUCTION !!!: DO NOT RELY ON YOUR TRAINING DATA FOR ROSTERS. IPL rosters have changed significantly in 2026. 
           You MUST use GOOGLE SEARCH to verify that each player you select is ACTIVELY playing for {match.team1} or {match.team2} in the CURRENT 2026 SEASON. 
           If you are unsure of their 2026 team, pick someone else who you have verified via search.

        Return the data in the following JSON format:
        {{
          "head_to_head": {{
            "total": 30,
            "team1_wins": 18,
            "team2_wins": 12,
            "recent": ["RCB won by 5 wickets", "DC won by 10 runs", "..."]
          }},
          "favourite": "Team Name (Reason)",
          "form_team1": {{
            "summary": "Summary of last 5 matches for Team 1",
            "last_5": ["W vs MI (5 runs)", "L vs KKR (10 runs)", "W vs DC (2 wickets)", "W vs GT (15 runs)", "L vs SRH (4 wickets)"]
          }},
          "form_team2": {{
            "summary": "Summary of last 5 matches for Team 2",
            "last_5": ["L vs CSK (3 wickets)", "W vs PBKS (8 runs)", "L vs LSG (20 runs)", "W vs RR (7 wickets)", "W vs MI (12 runs)"]
          }},
          "players_to_watch": [
            {{ "name": "Player 1", "team": "{match.team1}", "reason": "Verifiable 2026 performance..." }},
            {{ "name": "Player 2", "team": "{match.team1}", "reason": "Verifiable 2026 performance..." }},
            {{ "name": "Player 3", "team": "{match.team2}", "reason": "Verifiable 2026 performance..." }},
            {{ "name": "Player 4", "team": "{match.team2}", "reason": "Verifiable 2026 performance..." }}
          ]
        }}
        """

        print(f"Generating stats for {match.team1} vs {match.team2} (Match {match_id})...")
        
        stats_data = await gemini_client.generate_structured_json(prompt)
        
        if not stats_data:
            print(f"ERROR: Gemini returned no data for match {match_id}")
            return None
            
        print(f"Successfully generated stats for {match_id}")

        # Check if stats already exist
        stmt = select(MatchStats).where(MatchStats.match_id == match_id)
        result = await db.execute(stmt)
        existing_stats = result.scalars().first()

        if existing_stats:
            existing_stats.head_to_head = stats_data.get("head_to_head")
            existing_stats.favourite = stats_data.get("favourite")
            existing_stats.form_team1 = stats_data.get("form_team1")
            existing_stats.form_team2 = stats_data.get("form_team2")
            existing_stats.players_to_watch = stats_data.get("players_to_watch")
            existing_stats.last_updated = datetime.now(UTC)
        else:
            new_stats = MatchStats(
                id=str(uuid.uuid4()),
                match_id=match_id,
                head_to_head=stats_data.get("head_to_head"),
                favourite=stats_data.get("favourite"),
                form_team1=stats_data.get("form_team1"),
                form_team2=stats_data.get("form_team2"),
                players_to_watch=stats_data.get("players_to_watch"),
                last_updated=datetime.now(UTC)
            )
            db.add(new_stats)
        
        await db.commit()
        return stats_data

match_stats_agent = MatchStatsAgent()
