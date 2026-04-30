import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.getcwd())

from backend.campaigns_scoring import calculate_campaign_scores
from backend.database import async_session

async def main():
    campaign_id = "45ede007-c43e-4381-9f5a-c5de02b5ff4c"
    print(f"Recalculating scores for campaign: {campaign_id}")
    
    async with async_session() as db:
        await calculate_campaign_scores(campaign_id, db)
        print("Success!")

if __name__ == "__main__":
    asyncio.run(main())
