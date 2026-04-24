import asyncio
import os
import uuid
import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Setup
load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Import models
from backend.models import User, Match, Prediction, LeaderboardEntry
from backend.scheduler import generate_ai_prediction
from backend.scoring import calculate_match_scores

async def backfill_ai_assassin():
    async with async_session() as db:
        # 1. Find AI Assassin
        result = await db.execute(select(User).where(User.name == "AI Assassin"))
        ai_user = result.scalars().first()
        
        if not ai_user:
            print("❌ AI Assassin not found")
            return
            
        print(f"👤 Found {ai_user.name} (Current Base Points: {ai_user.base_points})")
        
        # 2. Find matches from 12 to 24
        result = await db.execute(select(Match).order_by(Match.toss_time.asc()))
        all_matches = result.scalars().all()
        
        # 2. Find all matches
        result = await db.execute(select(Match).order_by(Match.toss_time.asc()))
        all_matches = result.scalars().all()
        
        print(f"📅 Found {len(all_matches)} matches to process.")
        
        # 3. Calculate scores for all matches
        # This will apply the new rule: 0 penalty for AI before match 25
        print("\n🧮 Calculating scores for all matches...")
        for m in all_matches:
            if m.status == "completed":
                print(f"⚡ Recalculating Match {m.id}...")
                await calculate_match_scores(m.id, db)
            
        print("\n✨ Recalculation complete!")
        print(f"✅ AI Assassin's points have been updated.")
        print(f"✅ Base points remain at {ai_user.base_points}.")

if __name__ == "__main__":
    asyncio.run(backfill_ai_assassin())
