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

# Ensure absolute path for sqlite
if DATABASE_URL.startswith("sqlite"):
    import re
    match = re.match(r"(sqlite\+aiosqlite:///)(.+)", DATABASE_URL)
    if match:
        prefix, relative_path = match.groups()
        if not relative_path.startswith("/"):
            absolute_db_path = os.path.abspath(os.path.join(os.getcwd(), relative_path))
            DATABASE_URL = f"{prefix}{absolute_db_path}"

async def grant_powerups():
    print(f"🚀 Updating playoff powerups for all non-guest users...")
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.connect() as conn:
        try:
            # Grant 2 playoff powerups to everyone where is_guest is False
            result = await conn.execute(
                text("UPDATE users SET playoff_powerups = 2 WHERE is_guest = FALSE")
            )
            await conn.commit()
            print(f"✅ Successfully updated {result.rowcount} users.")
        except Exception as e:
            print(f"❌ Error: {e}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(grant_powerups())
