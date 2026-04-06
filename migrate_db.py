import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("❌ Error: DATABASE_URL not found in environment.")
    exit(1)

async def run_migration():
    print(f"🚀 Connecting to database: {DATABASE_URL[:20]}...")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        print("🔍 Checking and adding 'base_points' column to 'users' table...")
        
        # PostgreSQL specific 'ADD COLUMN IF NOT EXISTS' syntax
        # If it's SQLite, we catch the error manually
        try:
            # We use try/except for broader compatibility (SQLite doesn't support IF NOT EXISTS in ALTER)
            await conn.execute(text("ALTER TABLE users ADD COLUMN base_points INTEGER DEFAULT 0"))
            print("✅ Successfully added 'base_points' column.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column name" in str(e).lower():
                print("ℹ️ Column 'base_points' already exists. Skipping.")
            else:
                print(f"❌ Error during migration: {e}")
                
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN base_powerups INTEGER DEFAULT 10"))
            print("✅ Successfully added 'base_powerups' column.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column name" in str(e).lower():
                print("ℹ️ Column 'base_powerups' already exists. Skipping.")
            else:
                print(f"❌ Error during migration: {e}")
                
    print("✨ Migration complete!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
