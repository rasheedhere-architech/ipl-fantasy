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
        You are a cricket data analyst. Today is April 2026. The IPL 2026 season is currently underway.
        
        IMPORTANT: You MUST use the provided Google Search tool to find CURRENT, REAL-TIME IPL 2026 data. 
        Your training data is OUTDATED for the 2026 season. Do NOT guess or use old data.
        The search tool is enabled for you to find the latest standings, rosters, and match results.
        
        Search queries to use:
        - "{match.team1} vs {match.team2} IPL 2026 head to head"
        - "{match.team1} IPL 2026 results recent matches"
        - "{match.team2} IPL 2026 results recent matches"
        - "IPL 2026 points table standings April 2026"
        - "{match.team1} IPL 2026 squad players"
        - "{match.team2} IPL 2026 squad players"

        Match Details:
        Teams: {match.team1} vs {match.team2}
        Venue: {match.venue}
        Date/Time: {match.toss_time}

        !!! ROSTER FACTS FOR 2026 (OVERRIDE YOUR TRAINING DATA) !!!:
        - Rishabh Pant plays for LUCKNOW SUPER GIANTS (LSG), NOT Delhi Capitals.
        - Shreyas Iyer plays for PUNJAB KINGS (PBKS), NOT Kolkata Knight Riders.
        - IPL 2026 had a mega auction in late 2025. Many players changed teams.
        - ALWAYS verify a player's 2026 team via Google Search before listing them.

        Provide the following data (ALL must be sourced from Google Search results about IPL 2026):

        1. HEAD TO HEAD: All-time IPL record between {match.team1} and {match.team2}. Total matches, wins for each team. Last 5 encounter results with margins.
        2. IPL 2026 STANDINGS: Current points table position for both {match.team1} and {match.team2} — include position, matches played, wins, losses, points, and NRR.
        3. CURRENT FORM: Last 3-5 IPL 2026 match results for each team. Include opponent name and winning margin. Format as "W vs TEAM (margin)" or "L vs TEAM (margin)".
        4. MATCH FAVOURITE: Which team is favoured to win and why (based on current 2026 form, venue record, and standings).
        5. PLAYERS TO WATCH: 2 players from {match.team1} and 2 from {match.team2}. 
           - Each player MUST currently play for that team in IPL 2026. Verify via search.
           - Include a specific 2026 stat or recent performance as the reason.

        Return ONLY a JSON object in this exact format (no markdown, no explanation):
        {{
          "head_to_head": {{
            "total": 30,
            "team1_wins": 18,
            "team2_wins": 12,
            "recent": ["Team A won by 5 wickets (IPL 2025)", "Team B won by 10 runs (IPL 2025)", "..."]
          }},
          "standings_team1": {{
            "position": 3,
            "played": 9,
            "won": 6,
            "lost": 3,
            "points": 12,
            "nrr": "+0.450"
          }},
          "standings_team2": {{
            "position": 7,
            "played": 9,
            "won": 3,
            "lost": 6,
            "points": 6,
            "nrr": "-0.320"
          }},
          "favourite": "Team Name (Based on current 2026 form and standings...)",
          "form_team1": {{
            "summary": "Brief summary of Team 1's current 2026 campaign",
            "last_5": ["W vs MI (by 5 runs)", "L vs KKR (by 10 runs)", "W vs DC (by 2 wickets)", "W vs GT (by 15 runs)", "L vs SRH (by 4 wickets)"]
          }},
          "form_team2": {{
            "summary": "Brief summary of Team 2's current 2026 campaign",
            "last_5": ["L vs CSK (by 3 wickets)", "W vs PBKS (by 8 runs)", "L vs LSG (by 20 runs)", "W vs RR (by 7 wickets)", "W vs MI (by 12 runs)"]
          }},
          "players_to_watch": [
            {{ "name": "Player Name", "team": "{match.team1}", "reason": "Specific 2026 IPL stat or recent performance" }},
            {{ "name": "Player Name", "team": "{match.team1}", "reason": "Specific 2026 IPL stat or recent performance" }},
            {{ "name": "Player Name", "team": "{match.team2}", "reason": "Specific 2026 IPL stat or recent performance" }},
            {{ "name": "Player Name", "team": "{match.team2}", "reason": "Specific 2026 IPL stat or recent performance" }}
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
            existing_stats.standings_team1 = stats_data.get("standings_team1")
            existing_stats.standings_team2 = stats_data.get("standings_team2")
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
                standings_team1=stats_data.get("standings_team1"),
                standings_team2=stats_data.get("standings_team2"),
                last_updated=datetime.now(UTC)
            )
            db.add(new_stats)
        
        await db.commit()
        return stats_data

match_stats_agent = MatchStatsAgent()
