import os
import asyncio
import json
import uuid
from datetime import datetime, UTC
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text, select
from dotenv import load_dotenv

# Import models to use in script
# We'll use raw SQL for migrations to be safe and fast
# Then use SQLAlchemy for data seeding if needed

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("❌ Error: DATABASE_URL not found in environment.")
    exit(1)

# Ensure absolute path for sqlite
if DATABASE_URL.startswith("sqlite"):
    import re
    # Extract path from sqlite+aiosqlite:///path/to/db
    match = re.match(r"(sqlite\+aiosqlite:///)(.+)", DATABASE_URL)
    if match:
        prefix, relative_path = match.groups()
        if not relative_path.startswith("/"):
            absolute_db_path = os.path.abspath(os.path.join(os.getcwd(), relative_path))
            DATABASE_URL = f"{prefix}{absolute_db_path}"
            print(f"📍 Using absolute DB path: {DATABASE_URL}")

async def run_migration():
    print(f"🚀 Connecting to database for playoff migration...")
    engine = create_async_engine(DATABASE_URL)
    
    # 1. SCHEMA MIGRATIONS
    commands = [
        ("ALTER TABLE matches ADD COLUMN more_dot_balls_team VARCHAR", "matches.more_dot_balls_team"),
        ("ALTER TABLE matches ADD COLUMN is_playoff BOOLEAN DEFAULT FALSE", "matches.is_playoff"),
        ("ALTER TABLE predictions ADD COLUMN more_dot_balls_team VARCHAR", "predictions.more_dot_balls_team"),
        ("ALTER TABLE users ADD COLUMN playoff_powerups INTEGER DEFAULT 0", "users.playoff_powerups"),
    ]
    
    for sql, col_name in commands:
        async with engine.connect() as conn:
            try:
                await conn.execute(text(sql))
                await conn.commit()
                print(f"✅ Successfully added '{col_name}' column.")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column name" in str(e).lower():
                    print(f"ℹ️ Column '{col_name}' already exists. Skipping.")
                else:
                    print(f"❌ Error during migration of '{col_name}': {e}")

    # 2. SEED PLAYOFF MATCHES
    print("📅 Seeding playoff matches from playoff-matches.json...")
    try:
        with open("playoff-matches.json", "r") as f:
            data = json.load(f)
            playoff_matches = data.get("matches", [])
            
        async with engine.connect() as conn:
            for m in playoff_matches:
                match_id = f"ipl-2026-{m['match_no']}"
                
                # Check if exists
                res = await conn.execute(text("SELECT id FROM matches WHERE id = :id"), {"id": match_id})
                if res.fetchone():
                    print(f"ℹ️ Match {match_id} already exists. Skipping.")
                    continue
                
                # Parse date - assuming format "26-MAY-26" and time "7:30 PM"
                # This is a bit simplified, but matches existing seed logic usually
                toss_time_str = f"{m['date']} {m['start']}"
                try:
                    toss_time = datetime.strptime(toss_time_str, "%d-%b-%y %I:%M %p")
                except ValueError:
                    # Fallback or log error
                    print(f"⚠️ Could not parse date for match {match_id}: {toss_time_str}")
                    toss_time = datetime.now()

                await conn.execute(
                    text("""
                        INSERT INTO matches (id, team1, team2, venue, toss_time, status, is_playoff)
                        VALUES (:id, :team1, :team2, :venue, :toss_time, 'upcoming', TRUE)
                    """),
                    {
                        "id": match_id,
                        "team1": m["home"],
                        "team2": m["away"],
                        "venue": m["venue"],
                        "toss_time": toss_time,
                    }
                )
            await conn.commit()
            print("✅ Playoff matches seeded.")
    except Exception as e:
        print(f"❌ Error seeding matches: {e}")

    # 3. GRANT PLAYOFF POWER-UPS
    print("⚡ Granting 2 playoff power-ups to all users (except guests)...")
    async with engine.connect() as conn:
        try:
            await conn.execute(
                text("UPDATE users SET playoff_powerups = 2 WHERE is_guest = FALSE")
            )
            await conn.commit()
            print("✅ Playoff power-ups granted.")
        except Exception as e:
            print(f"❌ Error granting power-ups: {e}")

    print("✨ Playoff preparation complete!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
