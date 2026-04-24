import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from dotenv import load_dotenv

from backend.models import Match
from backend.scoring import calculate_match_scores

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

async def main():
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set")
        return

    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with async_session() as db:
        print("🚀 Fetching all completed matches...")
        result = await db.execute(select(Match).where(Match.status == "completed"))
        matches = result.scalars().all()
        
        print(f"🔄 Found {len(matches)} matches to process.")
        
        for m in matches:
            print(f"⚡ Processing Match {m.id} ({m.team1} vs {m.team2})...")
            try:
                await calculate_match_scores(m.id, db)
                print(f"✅ Completed scoring for {m.id}")
            except Exception as e:
                print(f"❌ Error processing {m.id}: {e}")
        
        print("✨ All matches re-processed. Breakdowns generated.")
        await db.commit()

        # 4. Invalidate Caches
        from backend.utils.cache import backend_cache
        backend_cache.invalidate("global_leaderboard")
        backend_cache.invalidate("match_podiums")
        backend_cache.invalidate("analysis")
        print("🧹 Caches invalidated.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
