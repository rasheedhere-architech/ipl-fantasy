
import asyncio
from sqlalchemy import text
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.getcwd())

from backend.database import engine

async def reset_db_schema():
    print("Renaming column and resetting Alembic state...")
    async with engine.begin() as conn:
        # 1. Rename column if it exists as cricapi_match_id
        # We'll use a safer check
        try:
            await conn.execute(text("ALTER TABLE matches RENAME COLUMN cricapi_match_id TO external_id;"))
            print("Renamed cricapi_match_id to external_id.")
        except Exception as e:
            print(f"Note: Column rename skipped/failed (likely already renamed): {e}")

        # 2. Reset Alembic
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version;"))
        print("Dropped alembic_version table.")

    print("Schema reset complete.")

if __name__ == "__main__":
    asyncio.run(reset_db_schema())
