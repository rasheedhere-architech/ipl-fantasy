
import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.getcwd())

from backend.database import engine, Base
from backend import models  # Essential to register models
from sqlalchemy import text

async def init_dev_db():
    print("Creating all tables from models...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Create alembic_version table and stamp it with the NEW head
        await conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num));"))
        await conn.execute(text("DELETE FROM alembic_version;"))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('49f1dc35f0d4');"))
        
    print("Dev DB initialized and stamped at 49f1dc35f0d4.")

if __name__ == "__main__":
    asyncio.run(init_dev_db())
