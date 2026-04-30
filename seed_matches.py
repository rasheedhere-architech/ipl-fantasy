
import asyncio
import json
import os
import uuid
from datetime import datetime, timedelta, UTC
from sqlalchemy import select, delete
from dotenv import load_dotenv

load_dotenv()

import sys
sys.path.append(os.getcwd())

from backend.database import async_session
from backend.models import Match, MatchStatus

def convert_ist_to_utc(date_str, time_str):
    dt_ist = datetime.strptime(f"{date_str} {time_str}", "%d-%b-%y %I:%M %p")
    dt_utc = dt_ist - timedelta(hours=5, minutes=30)
    return dt_utc.replace(tzinfo=UTC)

async def seed_manual_matches():
    if not os.path.exists("matches.json"):
        print("Error: matches.json not found!")
        return

    with open("matches.json", "r") as f:
        data = json.load(f)
    
    matches_list = data.get("matches", [])
    print(f"Loaded {len(matches_list)} matches from JSON.")

    async with async_session() as db:
        # Clear existing matches for a clean manual seed
        print("Clearing existing matches table...")
        await db.execute(delete(Match))
        await db.commit()

        count = 0
        for m in matches_list:
            match_no = m["match_no"]
            home = m["home"]
            away = m["away"]
            venue = m["venue"]
            
            utc_time = convert_ist_to_utc(m["date"], m["start"])
            m_id = f"ipl-2026-{match_no}"
            
            new_match = Match(
                id=m_id,
                external_id=m_id,
                team1=home,
                team2=away,
                venue=venue,
                start_time=utc_time,
                status=MatchStatus.upcoming
            )
            db.add(new_match)
            
            count += 1
            if count % 10 == 0:
                print(f"Processed {count} matches...")

        await db.commit()
        print(f"Successfully seeded {count} matches in UTC (Flattened Schema).")

if __name__ == "__main__":
    asyncio.run(seed_manual_matches())
