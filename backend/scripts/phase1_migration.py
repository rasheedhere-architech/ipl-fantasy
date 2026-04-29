
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, UTC
from sqlalchemy import select
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.getcwd())

from backend.database import async_session, engine
from backend.models import (
    User, Match, MatchStatus, Tournament, TournamentStatus, 
    League, Campaign, CampaignType, CampaignStatus, 
    CampaignQuestion, QuestionType, LeagueUserMapping,
    LeagueCampaignMapping
)

def convert_ist_to_utc(date_str, time_str):
    try:
        dt_ist = datetime.strptime(f"{date_str} {time_str}", "%d-%b-%y %I:%M %p")
        dt_utc = dt_ist - timedelta(hours=5, minutes=30)
        return dt_utc.replace(tzinfo=UTC)
    except Exception as e:
        print(f"Error parsing date {date_str} {time_str}: {e}")
        return datetime.now(UTC)

async def phase1_migration():
    async with async_session() as db:
        print("1. Creating Default Tournament: IPL 2026...")
        tournament_id = "ipl-2026"
        tournament = await db.get(Tournament, tournament_id)
        if not tournament:
            tournament = Tournament(
                id=tournament_id,
                name="IPL 2026",
                status=TournamentStatus.active,
                starts_at=convert_ist_to_utc("28-MAR-26", "7:30 PM"),
                ends_at=convert_ist_to_utc("24-MAY-26", "7:30 PM")
            )
            db.add(tournament)
            print("Created Tournament IPL 2026.")
        
        print("2. Creating OG League...")
        global_league_id = "og-league"
        global_league = await db.get(League, global_league_id)
        if not global_league:
            # Need a system user or admin to 'own' the global league
            admin_user = await db.execute(select(User).filter(User.is_admin == True))
            admin = admin_user.scalars().first()
            admin_id = admin.id if admin else "system"
            
            global_league = League(
                id=global_league_id,
                name="OG League",
                tournament_id=tournament_id,
                join_code="OGLEAGUE",
                created_by=admin_id
            )
            db.add(global_league)
            print("Created OG League.")

        print("3. Creating Master Match Campaign...")
        master_campaign_id = "master-match-campaign"
        master_campaign = await db.get(Campaign, master_campaign_id)
        if not master_campaign:
            master_campaign = Campaign(
                id=master_campaign_id,
                title="Master Match Predictions",
                description="Global questions for all IPL matches",
                type=CampaignType.match,
                is_master=True,
                status=CampaignStatus.active,
                created_by="system",
                tournament_id=tournament_id
            )
            db.add(master_campaign)
            
            # Add Questions
            questions = [
                ("Winner", QuestionType.dropdown, 10, True),
                ("Team 1 Powerplay Score", QuestionType.free_number, 5, True),
                ("Team 2 Powerplay Score", QuestionType.free_number, 5, True),
                ("Player of the Match", QuestionType.free_text, 10, False),
                ("More Sixes Team", QuestionType.dropdown, 5, False),
                ("More Fours Team", QuestionType.dropdown, 5, False)
            ]
            
            for i, (text, qtype, pts, mandatory) in enumerate(questions):
                q = CampaignQuestion(
                    id=str(uuid.uuid4()),
                    campaign_id=master_campaign_id,
                    question_text=text,
                    question_type=qtype,
                    scoring_rules={"exact_match_points": pts},
                    order_index=i,
                    is_mandatory=mandatory
                )
                db.add(q)
            print("Created Master Match Campaign with standard questions.")

        print("4. Mapping Master Campaign to Global League...")
        mapping = await db.get(LeagueCampaignMapping, (global_league_id, master_campaign_id))
        if not mapping:
            mapping = LeagueCampaignMapping(
                league_id=global_league_id,
                campaign_id=master_campaign_id
            )
            db.add(mapping)

        print("5. Seeding Matches from matches.json...")
        if os.path.exists("matches.json"):
            with open("matches.json", "r") as f:
                data = json.load(f)
            matches_list = data.get("matches", [])
            
            for m in matches_list:
                match_no = m["match_no"]
                m_id = f"ipl-2026-{match_no}"
                existing_match = await db.get(Match, m_id)
                if not existing_match:
                    utc_time = convert_ist_to_utc(m["date"], m["start"])
                    new_match = Match(
                        id=m_id,
                        external_id=m_id,
                        team1=m["home"],
                        team2=m["away"],
                        venue=m["venue"],
                        toss_time=utc_time,
                        status=MatchStatus.upcoming,
                        tournament_id=tournament_id
                    )
                    db.add(new_match)
            print(f"Seeded {len(matches_list)} matches.")

        print("6. Joining existing users to Global League and migrating stats...")
        users_result = await db.execute(select(User))
        users = users_result.scalars().all()
        for u in users:
            existing_mapping = await db.get(LeagueUserMapping, (global_league_id, u.id))
            if not existing_mapping:
                # Backfill remaining_powerups from legacy base_powerups
                db.add(LeagueUserMapping(
                    league_id=global_league_id, 
                    user_id=u.id,
                    remaining_powerups=u.base_powerups
                ))
                
                # Backfill points to Global League LeaderboardCache
                db.add(LeaderboardCache(
                    user_id=u.id,
                    league_id=global_league_id,
                    tournament_id=tournament_id,
                    total_points=u.points
                ))
                
                # Reset the user's global trackers to 0
                u.base_powerups = 0
                u.points = 0
        print(f"Joined {len(users)} users to Global League and migrated stats.")

        await db.commit()
    print("Phase 1 Migration Complete!")

if __name__ == "__main__":
    import sys
    asyncio.run(phase1_migration())
