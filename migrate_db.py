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
    
    commands = [
        ("ALTER TABLE users ADD COLUMN base_points INTEGER DEFAULT 0", "base_points"),
        ("ALTER TABLE users ADD COLUMN base_powerups INTEGER DEFAULT 10", "base_powerups"),
        ("ALTER TABLE predictions ADD COLUMN is_auto_predicted BOOLEAN DEFAULT FALSE", "is_auto_predicted"),
        ("ALTER TABLE users ADD COLUMN is_telegram_admin BOOLEAN DEFAULT FALSE", "is_telegram_admin"),
        ("ALTER TABLE users ADD COLUMN telegram_username VARCHAR", "telegram_username"),
        ("ALTER TABLE predictions ADD COLUMN points_breakdown JSON", "points_breakdown"),
        ("ALTER TABLE matches ADD COLUMN reported_by VARCHAR", "reported_by"),
        ("ALTER TABLE matches ADD COLUMN report_method VARCHAR", "report_method")
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
                
    print("✨ Migration complete!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
