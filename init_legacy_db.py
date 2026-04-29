
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.getcwd())

from backend.database import engine, Base
from backend import models  # Essential to register models
from sqlalchemy import text

async def init_legacy_db():
    print("Creating legacy tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Create alembic_version table and stamp it with the legacy head
        await conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num));"))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('dd647d82b2d4');"))
        
    print("Legacy DB initialized and stamped at dd647d82b2d4.")

if __name__ == "__main__":
    asyncio.run(init_legacy_db())
