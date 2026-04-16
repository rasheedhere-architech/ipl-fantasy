import asyncio
import uuid
from sqlalchemy.future import select
from sqlalchemy.sql import func
from backend.database import async_session
from backend.models import User, LeaderboardEntry

async def seed_ai():
    async with async_session() as db:
        print("Fetching real users to calculate average base points...")
        users_result = await db.execute(select(User).where(User.is_ai == False))
        real_users = users_result.scalars().all()
        
        if not real_users:
            print("No real users found! Giving the AI default 0 points.")
            avg_points = 0
        else:
            total_group_points = 0
            for u in real_users:
                # Get their leaderboard sum
                lb_sum = await db.execute(select(func.sum(LeaderboardEntry.points)).where(LeaderboardEntry.user_id == u.id))
                lb_val = lb_sum.scalar() or 0
                total_group_points += (u.base_points + lb_val)
                
            avg_points = int(total_group_points / len(real_users))
            # Round to nearest 0 or 5
            avg_points = round(avg_points / 5) * 5
        
        print(f"Calculated AI base points: {avg_points}")
        
        # Check if AI user already exists
        ai_result = await db.execute(select(User).where(User.is_ai == True))
        ai_user = ai_result.scalars().first()
        
        if not ai_user:
            print("Creating new AI Assassin user...")
            ai_user = User(
                id=str(uuid.uuid4()),
                google_id="ai_bot_google_id",
                email="ai_user@ipl-fantasy.local",
                name="AI Assassin",
                avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=ai_predictor",
                is_ai=True,
                base_points=avg_points,
                base_powerups=8
            )
            db.add(ai_user)
        else:
            print("AI Assassin user already exists. Overwriting current base points to recalibrated average.")
            ai_user.base_points = avg_points
            ai_user.base_powerups = 8
            
        await db.commit()
        print("AI seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_ai())
