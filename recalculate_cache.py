import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.getcwd())

from backend.scoring import update_leaderboard_cache
from backend.database import async_session

async def main():
    tournament_id = "ipl-2026"
    print(f"Recalculating leaderboard cache for tournament: {tournament_id}")
    
    async with async_session() as db:
        await update_leaderboard_cache(db, tournament_id)
        print("Success!")

if __name__ == "__main__":
    asyncio.run(main())
