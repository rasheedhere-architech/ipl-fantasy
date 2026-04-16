import asyncio
from backend.database import engine, Base
from backend.models import MatchV2, PredictionV2

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

asyncio.run(init())
