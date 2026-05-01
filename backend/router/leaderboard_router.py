from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, case, text

from backend.database import get_db
from backend.models import User, LeaderboardEntry, AllowlistedEmail, Match, CampaignResponse, TournamentUserMapping
from backend.dependencies import get_current_user
from backend.utils.cache import backend_cache

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])
START_MATCH_NO = 12

def match_filter_clause():
    """Returns a SQL expression to filter matches by the numeric suffix of match_id."""
    # SQLite/Postgres specific: Extract suffix after last '-'
    # For simplicity and cross-DB compatibility, we'll use a Python-side filter for now 
    # where possible, or a string comparison if the IDs are zero-padded.
    # Since they are not zero-padded (e.g. ipl-2026-7), we'll fetch matches first or use Python logic.
    pass

async def get_valid_match_ids(db: AsyncSession):
    from backend.models import Match
    res = await db.execute(select(Match.id))
    all_ids = res.scalars().all()
    return [mid for mid in all_ids if "-" in mid and mid.split("-")[-1].isdigit() and int(mid.split("-")[-1]) >= START_MATCH_NO]

@router.get("")
async def get_league_leaderboard(league_id: str = "ipl-2026-global", db: AsyncSession = Depends(get_db)):
    return await fetch_leaderboard_data(db, league_id)

async def fetch_leaderboard_data(db: AsyncSession, league_id: str):
    cache_key = f"leaderboard_{league_id}"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    valid_match_ids = await get_valid_match_ids(db)

    from backend.models import LeaderboardCache, LeagueUserMapping, Match, CampaignResponse, LeaderboardEntry

    # Determine if this is a global leaderboard request
    is_global = league_id.endswith("-global")
    tournament_id = league_id.replace("-global", "") if is_global else None
    
    if not tournament_id:
        # Fetch tournament_id from league if not global
        league_res = await db.execute(select(League.tournament_id).where(League.id == league_id))
        tournament_id = league_res.scalar_one_or_none()

    # Get leaderboard entries reading directly from LeaderboardCache
    query = select(
        User.id,
        User.name,
        User.avatar_url,
        func.coalesce(LeaderboardCache.total_points, 0).label("total_points"),
        func.coalesce(TournamentUserMapping.base_powerups, 10).label("base_powerups"),
    )
    
    if is_global:
        query = query.add_columns(
            func.null().label("joined_at")
        ).join(LeaderboardCache, (User.id == LeaderboardCache.user_id) & (LeaderboardCache.tournament_id == tournament_id) & (LeaderboardCache.league_id.is_(None))) \
         .outerjoin(TournamentUserMapping, (User.id == TournamentUserMapping.user_id) & (TournamentUserMapping.tournament_id == tournament_id))
    else:
        query = query.add_columns(
            LeagueUserMapping.joined_at
        ).join(LeagueUserMapping, (User.id == LeagueUserMapping.user_id) & (LeagueUserMapping.league_id == league_id)) \
         .outerjoin(LeaderboardCache, (User.id == LeaderboardCache.user_id) & (LeaderboardCache.league_id == league_id) & (LeaderboardCache.tournament_id == tournament_id)) \
         .outerjoin(TournamentUserMapping, (User.id == TournamentUserMapping.user_id) & (TournamentUserMapping.tournament_id == tournament_id))

    result = await db.execute(
        query
        .where(User.is_guest == False)
        .order_by(func.coalesce(LeaderboardCache.total_points, 0).desc())
    )
    
    users_raw_data = result.all()
    
    # Pre-fetch powerups used per user for this tournament
    powerups_used_res = await db.execute(
        select(CampaignResponse.user_id, func.count(CampaignResponse.id))
        .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
        .where(Campaign.tournament_id == tournament_id, CampaignResponse.use_powerup == True)
        .group_by(CampaignResponse.user_id)
    )
    powerups_used_map = {uid: count for uid, count in powerups_used_res.all()}

    # Map raw data to final user list
    users_data = []
    for row in users_raw_data:
        used = powerups_used_map.get(row.id, 0)
        remaining = max(0, row.base_powerups - used)
        users_data.append({
            "id": row.id,
            "name": row.name,
            "avatar_url": row.avatar_url,
            "total_points": row.total_points,
            "remaining_powerups": remaining,
            "joined_at": row.joined_at
        })
    
    # We will compute matches_played dynamically based on joined_at
    # by fetching match counts per user
    user_match_counts = {}
    user_progression = {}
    
    # Pre-fetch all match progressions for the valid matches for these users
    user_ids = [u["id"] for u in users_data]
    if user_ids:
        # 1. Aggregate points per match (Master + League Specific if applicable)
        subq = select(
            LeaderboardEntry.user_id,
            LeaderboardEntry.match_id,
            func.sum(LeaderboardEntry.points).label("match_points")
        ).where(LeaderboardEntry.user_id.in_(user_ids)) \
         .where(LeaderboardEntry.match_id.in_(valid_match_ids))

        if is_global:
            subq = subq.where(LeaderboardEntry.league_id == None)
        else:
            subq = subq.where(or_(LeaderboardEntry.league_id == None, LeaderboardEntry.league_id == league_id))
        
        subq = subq.group_by(LeaderboardEntry.user_id, LeaderboardEntry.match_id).subquery()

        # Join back to get match details
        prog_query = select(
            subq.c.user_id,
            subq.c.match_points,
            Match.team1, Match.team2, Match.id, Match.start_time
        ).join(Match, subq.c.match_id == Match.id)

        prog_res = await db.execute(prog_query.order_by(Match.start_time.desc()))
        
        # 2. Fetch League-specific Campaign Breakdowns from CampaignResponse.points_breakdown
        league_breakdowns = {}
        if not is_global:
            from backend.models import Campaign, CampaignResponse
            ca_res = await db.execute(
                select(
                    CampaignResponse.user_id,
                    CampaignResponse.match_id,
                    CampaignResponse.points_breakdown,
                )
                .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
                .where(CampaignResponse.user_id.in_(user_ids))
                .where(CampaignResponse.match_id.in_(valid_match_ids))
                .where(Campaign.is_master == False)
            )
            for uid, mid, breakdown in ca_res.all():
                if breakdown and "rules" in breakdown:
                    league_breakdowns.setdefault(uid, {}).setdefault(mid, []).extend(
                        [{**r, "category": f"[League] {r.get(chr(99)+chr(97)+chr(116)+chr(101)+chr(103)+chr(111)+chr(114)+chr(121), chr(63))}"}
                         for r in breakdown["rules"]]
                    )

        for uid, p, t1, t2, mid, start_time in prog_res.all():
            breakdown = None
            if uid not in user_progression:
                user_progression[uid] = []
            m_no = mid.split("-")[2] if "-" in mid else mid
            
            # Merge league breakdown if available
            final_breakdown = breakdown or {"rules": [], "total": p or 0}
            if uid in league_breakdowns and mid in league_breakdowns[uid]:
                if "rules" not in final_breakdown:
                    final_breakdown["rules"] = []
                final_breakdown["rules"].extend(league_breakdowns[uid][mid])
                # Ensure total is updated if needed (though 'p' should already be the sum if we grouped correctly)
                final_breakdown["total"] = p or 0

            user_progression[uid].append({
                "match_number": m_no,
                "teams": f"{t1} vs {t2}",
                "points": p or 0,
                "breakdown": final_breakdown,
                "start_time": start_time
            })


    entries = []
    for rank, (uid, name, avatar, points, remaining_powerups, joined_at) in enumerate(users_data, start=1):
        # Use pre-fetched progression data; filter to matches after joined_at
        raw_progression = user_progression.get(uid, [])
        # Filter to matches after the user joined the league
        if joined_at:
            raw_progression = [p for p in raw_progression if p["start_time"] >= joined_at]
        # Filter to start match number, take last 10
        progression = [
            {"match_number": p["match_number"], "teams": p["teams"], "points": p["points"], "breakdown": p["breakdown"]}
            for p in raw_progression if p["match_number"].isdigit() and int(p["match_number"]) >= START_MATCH_NO
        ][:10]

        matches_played = len(raw_progression)
        
        entries.append({
            "rank": rank,
            "username": name,
            "avatar_url": avatar,
            "total_points": points,
            "matches_played": matches_played,
            "remaining_powerups": remaining_powerups or 0,
            "progression": progression,
            "accuracy_pct": 0
        })
    
    backend_cache.set(cache_key, entries)
    return entries

@router.get("/match/{match_id}")
async def get_match_leaderboard(match_id: str, db: AsyncSession = Depends(get_db)):
    cache_key = f"match_leaderboard_{match_id}"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    result = await db.execute(
        select(User.id, User.name, User.avatar_url, LeaderboardEntry.points)
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .where(LeaderboardEntry.match_id == match_id)
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
        .order_by(LeaderboardEntry.points.desc())
    )
    
    entries = []
    for rank, (uid, name, avatar, points) in enumerate(result.all(), start=1):
        entries.append({
            "rank": rank,
            "username": name,
            "avatar_url": avatar,
            "match_points": points
        })
    
    backend_cache.set(cache_key, entries)
    return entries

@router.get("/match-podiums")
async def get_match_podiums(db: AsyncSession = Depends(get_db)):
    cache_key = "match_podiums"
    # cached = backend_cache.get(cache_key)
    # if cached: return cached

    from backend.models import Match, CampaignResponse
    matches_res = await db.execute(
        select(Match)
        .where(Match.status == "completed")
        .order_by(Match.start_time.desc())
    )
    matches = matches_res.scalars().all()
    
    podiums = []
    for m in matches:
        lb_res = await db.execute(
            select(User.name, User.avatar_url, LeaderboardEntry.points, CampaignResponse.use_powerup)
            .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
            .outerjoin(CampaignResponse, (User.id == CampaignResponse.user_id) & (LeaderboardEntry.match_id == CampaignResponse.match_id) & (CampaignResponse.use_powerup == True))
            .where(LeaderboardEntry.match_id == m.id)
            .order_by(LeaderboardEntry.points.desc())
        )
        
        all_players = lb_res.all()
        top_players = []
        current_rank = 0
        last_points = None
        
        for i, (name, avatar, pts, used_pw) in enumerate(all_players):
            if pts != last_points:
                current_rank = i + 1
            
            if current_rank > 3:
                break
                
            top_players.append({
                "username": name,
                "avatar_url": avatar,
                "points": pts,
                "rank": current_rank,
                "used_powerup": used_pw == "Yes"
            })
            last_points = pts
        
        mid = m.id
        m_no = mid.split("-")[2] if "-" in mid else mid
        podiums.append({
            "match_id": m.id,
            "match_number": m_no,
            "match_name": f"{m.team1} vs {m.team2}",
            "match_date": m.start_time,
            "top_players": top_players
        })
    
    backend_cache.set(cache_key, podiums)
    return podiums

@router.get("/analysis")
async def get_analysis_data(db: AsyncSession = Depends(get_db)):
    cache_key = "analysis"
    cached = backend_cache.get(cache_key)
    if cached: 
        return cached

    from datetime import UTC, datetime, timedelta
    now = datetime.now(UTC)
    last_week = now - timedelta(days=7)
    
    from backend.models import Match
    
    valid_match_ids = await get_valid_match_ids(db)
    
    # 1. Weekly Performance
    weekly_res = await db.execute(
        select(
            User.id,
            User.name,
            User.avatar_url,
            func.sum(LeaderboardEntry.points).label("weekly_points"),
            func.count(LeaderboardEntry.match_id).label("matches_played")
        )
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.start_time >= last_week)
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False)

        .group_by(User.id)
        .order_by(func.sum(LeaderboardEntry.points).desc())
    )
    
    weekly_stats = []
    for uid, name, avatar, pts, count in weekly_res.all():
        weekly_stats.append({
            "username": name,
            "avatar_url": avatar,
            "points": pts,
            "matches": count
        })

    # 2. Today's Performance (Last 24h)
    today_start = now - timedelta(days=1)
    today_res = await db.execute(
        select(
            User.name,
            User.avatar_url,
            func.sum(LeaderboardEntry.points).label("today_points"),
            func.count(LeaderboardEntry.match_id).label("matches_played")
        )
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.start_time >= today_start)
        .where(User.is_guest == False)
        .group_by(User.id, User.name, User.avatar_url)
        .order_by(func.sum(LeaderboardEntry.points).desc())
    )
    
    today_stats = []
    for name, avatar, pts, count in today_res.all():
        today_stats.append({
            "username": name,
            "avatar_url": avatar,
            "points": pts,
            "matches": count
        })

    # 3. Powerups Analytics
    from backend.models import CampaignResponse, TournamentUserMapping
    powerup_usage_res = await db.execute(
        select(
            User.name,
            User.avatar_url,
            TournamentUserMapping.base_powerups,
            Match.team1,
            Match.team2,
            Match.id.label("match_id"),
            Match.start_time,
            CampaignResponse.total_points,
            Match.status
        )
        .join(CampaignResponse, User.id == CampaignResponse.user_id)
        .join(Match, CampaignResponse.match_id == Match.id)
        .outerjoin(TournamentUserMapping, (User.id == TournamentUserMapping.user_id) & (TournamentUserMapping.tournament_id == tournament_id))
        .where(CampaignResponse.use_powerup == True)
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False)
        .order_by(User.name, Match.start_time.desc())
    )

    
    powerup_stats_map = {}
    for name, avatar, base, t1, t2, mid, start_time, points, status in powerup_usage_res.all():
        if name not in powerup_stats_map:
            powerup_stats_map[name] = {
                "username": name,
                "avatar_url": avatar,
                "base_powerups": base or 10,
                "used_matches": [],
                "total_powerup_points": 0,
                "avg_points_per_powerup": 0
            }
        
        m_no = mid.split("-")[2] if "-" in mid else mid
        powerup_stats_map[name]["used_matches"].append({
            "match_id": mid,
            "match_number": m_no,
            "teams": f"{t1} vs {t2}",
            "date": start_time,
            "points": points or 0,
            "match_status": status
        })
        
        if status == "completed":
            powerup_stats_map[name]["total_powerup_points"] += (points or 0)

    for stats in powerup_stats_map.values():
        completed_count = len([m for m in stats["used_matches"] if m["match_status"] == "completed"])
        if completed_count > 0:
            stats["avg_points_per_powerup"] = round(stats["total_powerup_points"] / completed_count, 1)
    
    # Include all relevant users even if they haven't used powerups
    all_users_res = await db.execute(
        select(User.name, User.avatar_url, TournamentUserMapping.base_powerups)
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .outerjoin(TournamentUserMapping, (User.id == TournamentUserMapping.user_id) & (TournamentUserMapping.tournament_id == tournament_id))
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
    )
    all_users_list = all_users_res.all()
    for name, avatar, base in all_users_list:
        if name not in powerup_stats_map:
            powerup_stats_map[name] = {
                "username": name,
                "avatar_url": avatar,
                "base_powerups": base or 10,
                "used_matches": []
            }

    # 4. Global Accuracy Stats (Max 55 points per match)
    accuracy_res = await db.execute(
        select(
            User.id,
            User.name,
            func.sum(
                case(
                    (CampaignResponse.use_powerup == True, CampaignResponse.total_points / 2),
                    else_=func.coalesce(CampaignResponse.total_points, 0)
                )
            ).label("base_match_points"),
            func.count(Match.id).label("completed_matches")
        )
        .join(CampaignResponse, User.id == CampaignResponse.user_id)
        .join(Match, CampaignResponse.match_id == Match.id)
        .where(Match.status == "completed")
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False)
        .group_by(User.id, User.name)
    )

    
    accuracy_map = {}
    for uid, name, base_pts, count in accuracy_res.all():
        if count > 0:
            accuracy_map[name] = round((base_pts / (count * 55)) * 100, 1)

    # 5. Match Wins Stats (Who won the most matches)
    match_wins_res = await db.execute(
        select(Match.id, User.name, LeaderboardEntry.points)
        .join(LeaderboardEntry, Match.id == LeaderboardEntry.match_id)
        .join(User, LeaderboardEntry.user_id == User.id)
        .where(Match.status == "completed")
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False)
    )

    
    match_scores = {} # match_id -> List of (username, points)
    for mid, name, pts in match_wins_res.all():
        if mid not in match_scores:
            match_scores[mid] = []
        match_scores[mid].append((name, pts))
        
    user_wins_map = {} # username -> List of match_numbers
    for mid, players in match_scores.items():
        if not players: continue
        max_pts = max(p[1] for p in players)
        # Rule: Any player with the max score is a winner
        winners = [p[0] for p in players if p[1] == max_pts]
        m_no = mid.split("-")[2] if "-" in mid else mid
        for winner_name in winners:
            if winner_name not in user_wins_map:
                user_wins_map[winner_name] = []
            user_wins_map[winner_name].append(m_no)

    # 6. Standing & Percentile Calculation (Based on LeaderboardCache for Global League)
    from backend.models import LeaderboardCache
    lb_result = await db.execute(
        select(
            User.name,
            func.coalesce(LeaderboardCache.total_points, 0).label("total_points")
        )
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
        .outerjoin(LeaderboardCache, (User.id == LeaderboardCache.user_id) & (LeaderboardCache.league_id == "ipl-2026-global"))
        .order_by(func.coalesce(LeaderboardCache.total_points, 0).desc())
    )
    
    lb_data = lb_result.all()
    total_players = len(lb_data)
    percentile_map = {}
    for rank, (name, pts) in enumerate(lb_data, start=1):
        if total_players > 0:
            percentile = round(((total_players - rank + 1) / total_players) * 100, 1)
            percentile_map[name] = percentile

    # 7. Badges & Special Achievements (Simplified by fetching LeaderboardEntry points_breakdown)
    all_le_res = await db.execute(
        select(User.name, LeaderboardEntry.points, LeaderboardEntry.points_breakdown, Match.id.label("match_id"), Match.start_time, Match.status)
        .join(User, LeaderboardEntry.user_id == User.id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False)
        .order_by(Match.start_time)
    )
    all_les = all_le_res.all()

    user_entries = {}
    chase_events = []
    
    bravo_map = {}
    bumrah_map = {}
    streak_map = {}
    wall_map = {}
    ht_map = {}
    dhoni_map = {}
    impact_map = {}
    boss_map = {}
    mystery_map = {}
    cb_map = {}
    hw_map = {}
    direct_map = {}
    sixster_map = {}
    fourster_map = {}
    doosra_map = {}
    army_map = {}
    maxwell_map = {}
    switch_map = {}

    for name, pts, breakdown, mid, m_start_time, m_status in all_les:
        if m_status != "completed": continue
        if name not in user_entries: user_entries[name] = []
        user_entries[name].append(pts)
        chase_events.append((name, m_start_time, pts))

        # Check universe boss (max single score)
        boss_map[name] = max(boss_map.get(name, 0), pts)
        
        if not breakdown or "rules" not in breakdown: continue
        
        # Analyze breakdown
        used_powerup = False
        match_impact = 0
        is_perfect = False
        is_hw = False
        for rule in breakdown["rules"]:
            cat = str(rule.get("category", "")).lower()
            r_pts = rule.get("points", 0)
            
            if "powerplay" in cat:
                if r_pts == 15 or r_pts == 30: # 15 base or 30 with powerup
                    bumrah_map[name] = bumrah_map.get(name, 0) + 1
                if r_pts == 5 or r_pts == 10:
                    direct_map[name] = direct_map.get(name, 0) + 1
                if r_pts >= 10:
                    match_impact += r_pts
            
            if "sixes" in cat and r_pts >= 5:
                sixster_map[name] = sixster_map.get(name, 0) + 1
            
            if "fours" in cat and r_pts >= 5:
                fourster_map[name] = fourster_map.get(name, 0) + 1
            
            if "winner" in cat:
                if r_pts < 0:
                    doosra_map[name] = doosra_map.get(name, 0) + 1
                    
            if cat == "powerup 2x used":
                used_powerup = True
                if pts < 0:
                    hw_map[name] = hw_map.get(name, 0) + 1
                elif pts > 0:
                    maxwell_map[name] = max(maxwell_map.get(name, 0), pts)
                    
        impact_map[name] = impact_map.get(name, 0) + match_impact
        if pts >= 30:
            cb_map[name] = cb_map.get(name, 0) + 1

    for name, scores in user_entries.items():
        # Streaks
        max_streak = 0
        current_streak = 0
        max_ht = 0
        current_ht = 0
        for s in scores:
            if s > 0:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0
                
            if s >= 30:
                current_ht += 1
                max_ht = max(max_ht, current_ht)
            else:
                current_ht = 0
                
        streak_map[name] = max_streak
        ht_map[name] = max_ht
        
        last_10 = scores[-10:]
        wall_map[name] = len([s for s in last_10 if s >= 20])
        
        final_5 = scores[-5:]
        if len(final_5) >= 3:
            dhoni_map[name] = sum(final_5) / len(final_5)

    chase_map = {}
    chase_date_map = {}
    # Simple chase calculation
    # (Removed full rank logic to keep file clean)

    def get_winners(data_map):
        if not data_map: return []
        max_val = max(data_map.values())
        if max_val <= 0: return []
        winners = []
        for name, val in data_map.items():
            if val == max_val:
                avatar = next((u[1] for u in all_users_list if u[0] == name), None)
                winners.append({"username": name, "avatar_url": avatar, "value": val})
        return winners

    def get_chase_winners(data_map, date_map):
        return []

    hall_of_fame = {
        "heath_streak": get_winners(streak_map),
        "dwayne_bravo": get_winners(bravo_map),
        "yorker_king": get_winners(bumrah_map),
        "universe_boss": get_winners(boss_map),
        "the_wall": get_winners(wall_map),
        "hat_trick": get_winners(ht_map),
        "the_big_show": get_winners(maxwell_map),
        "captain_cool": get_winners(dhoni_map),
        "chase_master": get_chase_winners(chase_map, chase_date_map),
        "impact_player": get_winners(impact_map),
        "switch_hit": get_winners(switch_map),
        "caught_bowled": get_winners(cb_map),
        "hit_wicket": get_winners(hw_map),
        "direct_hit": get_winners(direct_map),
        "doosra_spinner": get_winners(doosra_map),
        "one_man_army": get_winners(army_map),
        "sixster": get_winners(sixster_map),
        "fourster": get_winners(fourster_map),
    }

    # 9. Final Response Structure
    analysis_data = {
        "weekly_podium": weekly_stats[:5],
        "today_podium": today_stats[:5],
        "recent_podiums": await get_match_podiums(db),
        "hall_of_fame": hall_of_fame,
        "powerups_stats": [
            {
                **v, 
                "match_wins": len(user_wins_map.get(k, [])),
                "won_matches": sorted(user_wins_map.get(k, []), key=lambda x: int(x) if x.isdigit() else 0),
                "accuracy": accuracy_map.get(k, 0) # Keep for UI styling consistency
            } 
            for k, v in powerup_stats_map.items()
        ],
        "accuracy_stats": [
            {
                "username": name,
                "avatar_url": avatar,
                "accuracy": accuracy_map.get(name, 0),
                "percentile": percentile_map.get(name, 0),
                "total_points": next((pts for n, pts in lb_data if n == name), 0),
                "badges": [
                    {"type": "streak", "name": "Heath Streak", "value": streak_map.get(name, 0)} if streak_map.get(name, 0) >= 2 else None,
                    {"type": "brave", "name": "Bravo Award", "value": bravo_map.get(name, 0)} if bravo_map.get(name, 0) >= 1 else None,
                    {"type": "bumrah", "name": "Yorker King", "value": bumrah_map.get(name, 0)} if bumrah_map.get(name, 0) >= 1 else None,
                    {"type": "wall", "name": "The Wall", "value": "Consistent"} if wall_map.get(name, 0) >= 7 else None,
                    {"type": "malinga", "name": "Hat-Trick", "value": "Triple Threat"} if ht_map.get(name, 0) >= 3 else None,
                    {"type": "sachin", "name": "Master Blaster", "value": "Milestone"} if next((pts for n, pts in lb_data if n == name), 0) >= 500 else None,
                    {"type": "maxwell", "name": "The Big Show", "value": f"{maxwell_map.get(name, 0)} Pts"} if maxwell_map.get(name, 0) >= 40 else None,
                    {"type": "kohli", "name": "Chase Master", "value": f"Up {chase_map.get(name, 0)} ({chase_date_map.get(name).strftime('%b %d') if chase_date_map.get(name) else ''})"} if chase_map.get(name, 0) >= 3 else None,
                    {"type": "russell", "name": "Impact Player", "value": "Powerplay King"} if impact_map.get(name, 0) >= 100 else None,
                    {"type": "sixster", "name": "Sixster", "value": f"{sixster_map.get(name, 0)} Sixes"} if sixster_map.get(name, 0) >= 1 else None,
                    {"type": "fourster", "name": "Fourster", "value": f"{fourster_map.get(name, 0)} Fours"} if fourster_map.get(name, 0) >= 1 else None,
                ]
            }
            for name, avatar, base in all_users_list
        ]
    }
    
    # Filter out None badges
    for stat in analysis_data["accuracy_stats"]:
        stat["badges"] = [b for b in stat["badges"] if b is not None]
    
    backend_cache.set(cache_key, analysis_data)
    return analysis_data


@router.get("/my-leagues")
async def get_my_leagues(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all leagues the current user belongs to with their current cached points."""
    from backend.models import League, LeagueUserMapping, LeaderboardCache, Tournament

    result = await db.execute(
        select(
            League.id,
            League.name,
            League.join_code,
            Tournament.name.label("tournament_name"),
            LeagueUserMapping.joined_at,
            func.coalesce(LeaderboardCache.total_points, 0).label("my_points")
        )
        .join(LeagueUserMapping, (League.id == LeagueUserMapping.league_id) & (LeagueUserMapping.user_id == current_user.id))
        .join(Tournament, League.tournament_id == Tournament.id)
        .outerjoin(LeaderboardCache, (LeaderboardCache.league_id == League.id) & (LeaderboardCache.user_id == current_user.id))
        .order_by(League.created_at)
    )

    leagues = []
    for lid, lname, jcode, tname, joined_at, my_pts in result.all():
        count_res = await db.execute(
            select(func.count(LeagueUserMapping.user_id)).where(LeagueUserMapping.league_id == lid)
        )
        member_count = count_res.scalar() or 0
        
        # Calculate remaining powerups for the tournament this league belongs to
        league_obj = await db.get(League, lid)
        t_id = league_obj.tournament_id
        
        mapping_res = await db.execute(select(TournamentUserMapping).where(TournamentUserMapping.user_id == current_user.id, TournamentUserMapping.tournament_id == t_id))
        mapping = mapping_res.scalars().first()
        base_pu = mapping.base_powerups if mapping else 10
        
        used_res = await db.execute(
            select(func.count(CampaignResponse.id))
            .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
            .where(CampaignResponse.user_id == current_user.id, CampaignResponse.use_powerup == True, Campaign.tournament_id == t_id)
        )
        used_pu = used_res.scalars().first() or 0
        
        leagues.append({
            "id": lid,
            "name": lname,
            "join_code": jcode,
            "tournament_name": tname,
            "joined_at": joined_at,
            "remaining_powerups": max(0, base_pu - used_pu),
            "my_points": my_pts,
            "member_count": member_count
        })

    # Add Global Leaderboard entry for each tournament the user is in
    tournaments_stmt = select(Tournament).join(League).join(LeagueUserMapping).where(LeagueUserMapping.user_id == current_user.id).distinct()
    tournaments = (await db.execute(tournaments_stmt)).scalars().all()
    
    for t in tournaments:
        mapping_res = await db.execute(select(TournamentUserMapping).where(TournamentUserMapping.user_id == current_user.id, TournamentUserMapping.tournament_id == t.id))
        mapping = mapping_res.scalars().first()
        base_pu = mapping.base_powerups if mapping else 10
        
        used_res = await db.execute(
            select(func.count(CampaignResponse.id))
            .join(Campaign, CampaignResponse.campaign_id == Campaign.id)
            .where(CampaignResponse.user_id == current_user.id, CampaignResponse.use_powerup == True, Campaign.tournament_id == t.id)
        )
        used_pu = used_res.scalars().first() or 0

        leagues.insert(0, {
            "id": f"{t.id}-global",
            "name": "Global Leaderboard",
            "join_code": None,
            "tournament_name": t.name,
            "joined_at": None,
            "remaining_powerups": max(0, base_pu - used_pu),
            "my_points": 0, # Could fetch this from cache if needed
            "member_count": 0, # Not applicable for global in this context
            "is_global": True
        })

    return leagues
