
import asyncio
import json
import os
import uuid
from datetime import datetime, timedelta, UTC
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

import sys
sys.path.append(os.getcwd())

from backend.database import async_session, engine, Base
from backend.models import Match, MatchStatus, Prediction

def convert_ist_to_utc(date_str, time_str):
    dt_ist = datetime.strptime(f"{date_str} {time_str}", "%d-%b-%y %I:%M %p")
    dt_utc = dt_ist - timedelta(hours=5, minutes=30)
    return dt_utc.replace(tzinfo=UTC)

async def reset_and_seed():
    print("1. Wiping and Re-creating Database Tables...")
    async with engine.begin() as conn:
        # Drop everything
        await conn.execute(text("DROP TABLE IF EXISTS predictions CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS leaderboard_entries CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS questions CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS matches CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS allowlisted_emails CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS scoring_rules CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version;"))
        
        # Create everything fresh from models
        await conn.run_sync(Base.metadata.create_all)
    
    print("2. Loading matches.json...")
    if not os.path.exists("matches.json"):
        print("Error: matches.json not found!")
        return

    with open("matches.json", "r") as f:
        data = json.load(f)
    matches_list = data.get("matches", [])

    print(f"3. Seeding {len(matches_list)} matches...")
    async with async_session() as db:
        count = 0
        for m in matches_list:
            match_no = m["match_no"]
            utc_time = convert_ist_to_utc(m["date"], m["start"])
            m_id = f"ipl-2026-{match_no}"
            
            new_match = Match(
                id=m_id,
                external_id=m_id,
                team1=m["home"],
                team2=m["away"],
                venue=m["venue"],
                toss_time=utc_time,
                status=MatchStatus.upcoming
            )
            db.add(new_match)
            count += 1

        await db.commit()
    print(f"Successfully reset DB and seeded {count} matches (Questions are now schema-based).")

if __name__ == "__main__":
    asyncio.run(reset_and_seed())
