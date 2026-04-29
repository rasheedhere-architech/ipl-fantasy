import asyncio
import os
import sys

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database import async_session
from backend.scoring import update_leaderboard_cache
from sqlalchemy import select
from backend.models import Tournament

async def main():
    async with async_session() as db:
        res = await db.execute(select(Tournament))
        tournaments = res.scalars().all()
        for t in tournaments:
            print(f"Recalculating leaderboard for tournament: {t.name} ({t.id})...")
            await update_leaderboard_cache(db, t.id)
        print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
