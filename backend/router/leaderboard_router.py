from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, case, text

from backend.database import get_db
from backend.models import User, LeaderboardEntry, AllowlistedEmail, Match, Prediction
from backend.utils.cache import backend_cache

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])
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
async def get_global_leaderboard(db: AsyncSession = Depends(get_db)):
    cache_key = "global_leaderboard"
    cached = backend_cache.get(cache_key)
    if cached:
        return cached

    valid_match_ids = await get_valid_match_ids(db)

    # Group by user summing all points from valid matches
    result = await db.execute(
        select(
            User.id,
            User.name,
            User.avatar_url,
            (func.coalesce(func.sum(case((LeaderboardEntry.match_id.in_(valid_match_ids), LeaderboardEntry.points), else_=0)), 0) + User.base_points).label("total_points"),
            func.count(case((LeaderboardEntry.match_id.in_(valid_match_ids), LeaderboardEntry.match_id), else_=None)).label("matches_played"),
            User.base_points,
            User.base_powerups
        )
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
        .outerjoin(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .group_by(User.id, User.base_points, User.base_powerups)
        .order_by((func.coalesce(func.sum(case((LeaderboardEntry.match_id.in_(valid_match_ids), LeaderboardEntry.points), else_=0)), 0) + User.base_points).desc())
    )
    
    users_data = result.all()
    
    from backend.models import Prediction
    p_res = await db.execute(
        select(Prediction.user_id, func.count(Prediction.id))
        .where(Prediction.use_powerup == "Yes")
        .group_by(Prediction.user_id)
    )
    powerups_used_map = {row[0]: row[1] for row in p_res.all()}

    
    entries = []
    for rank, (uid, name, avatar, points, played, bp, total_powerups) in enumerate(users_data, start=1):
        # Fetch detailed per-match progression for this user
        from backend.models import Match, Prediction
        prog_res = await db.execute(
            select(LeaderboardEntry.points, Match.team1, Match.team2, Match.id, Prediction.points_breakdown)
            .join(Match, LeaderboardEntry.match_id == Match.id)
            .outerjoin(Prediction, (LeaderboardEntry.user_id == Prediction.user_id) & (LeaderboardEntry.match_id == Prediction.match_id))
            .where(LeaderboardEntry.user_id == uid)
            .order_by(Match.toss_time.desc())
        )
        detailed_progression = []
        for p, t1, t2, mid, breakdown in prog_res.all():
            m_no = mid.split("-")[2] if "-" in mid else mid
            detailed_progression.append({
                "match_number": m_no,
                "teams": f"{t1} vs {t2}",
                "points": p,
                "breakdown": breakdown
            })
        progression = detailed_progression # Now an array of objects!
        # Filter progression to only show matches from START_MATCH_NO onwards if desired, 
        # but usually history is okay to show. The USER said "Calculate points from 12", 
        # so we'll keep the history but the TOTAL is filtered.
        # Actually, let's filter history too for consistency with "points from 12".
        progression = [p for p in detailed_progression if int(p["match_number"]) >= START_MATCH_NO][:10]

        
        used = powerups_used_map.get(uid, 0)
        remaining_powerups = max(0, (total_powerups or 10) - used)
        
        entries.append({
            "rank": rank,
            "username": name,
            "avatar_url": avatar,
            "total_points": points,
            "matches_played": played,
            "base_points": bp,
            "remaining_powerups": remaining_powerups,
            "progression": progression, # Array of [25, 10, -20...]
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

    from backend.models import Match, Prediction
    matches_res = await db.execute(
        select(Match)
        .where(Match.status == "completed")
        .order_by(Match.toss_time.desc())
    )
    matches = matches_res.scalars().all()
    
    podiums = []
    for m in matches:
        lb_res = await db.execute(
            select(User.name, User.avatar_url, LeaderboardEntry.points, Prediction.use_powerup)
            .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
            .outerjoin(Prediction, (User.id == Prediction.user_id) & (LeaderboardEntry.match_id == Prediction.match_id))
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
            "match_date": m.toss_time,
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
        .where(Match.toss_time >= last_week)
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
        .where(Match.toss_time >= today_start)
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
    from backend.models import Prediction
    powerup_usage_res = await db.execute(
        select(
            User.name,
            User.avatar_url,
            User.base_powerups,
            Match.team1,
            Match.team2,
            Match.id.label("match_id"),
            Match.toss_time,
            Prediction.points_awarded,
            Match.status
        )
        .join(Prediction, User.id == Prediction.user_id)
        .join(Match, Prediction.match_id == Match.id)
        .where(Prediction.use_powerup == "Yes")
        .where(Match.id.in_(valid_match_ids))
        .where(User.is_guest == False)
        .order_by(User.name, Match.toss_time.desc())
    )

    
    powerup_stats_map = {}
    for name, avatar, base, t1, t2, mid, toss_time, points, status in powerup_usage_res.all():
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
            "date": toss_time,
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
        select(User.name, User.avatar_url, User.base_powerups)
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
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
                    (Prediction.use_powerup == "Yes", Prediction.points_awarded / 2),
                    else_=func.coalesce(Prediction.points_awarded, 0)
                )
            ).label("base_match_points"),
            func.count(Match.id).label("completed_matches")
        )
        .join(Prediction, User.id == Prediction.user_id)
        .join(Match, Prediction.match_id == Match.id)
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

    # 6. Standing & Percentile Calculation (Based on Total Points)
    # We'll use the global leaderboard logic here
    lb_result = await db.execute(
        select(
            User.name,
            (func.coalesce(func.sum(case((LeaderboardEntry.match_id.in_(valid_match_ids), LeaderboardEntry.points), else_=0)), 0) + User.base_points).label("total_points")
        )
        .outerjoin(AllowlistedEmail, User.email == AllowlistedEmail.email)
        .where(User.is_guest == False)
        .where(or_(AllowlistedEmail.email != None, User.is_ai == True))
        .outerjoin(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .group_by(User.id, User.base_points)
        .order_by(text("total_points DESC"))
    )
    
    lb_data = lb_result.all()
    total_players = len(lb_data)
    percentile_map = {}
    for rank, (name, pts) in enumerate(lb_data, start=1):
        if total_players > 0:
            # Formula: (Total - Rank + 1) / Total * 100
            # Rank 1 in 10 players = (10 - 1 + 1) / 10 * 100 = 100%
            percentile = round(((total_players - rank + 1) / total_players) * 100, 1)
            percentile_map[name] = percentile

    # 7. Badges & Special Achievements
    # 7a. Dwayne Bravo (Braveheart) - Powerplay predictions < 35 or > 100
    bravo_res = await db.execute(
        select(User.name, func.count(Prediction.id))
        .join(User, Prediction.user_id == User.id)
        .where(or_(
            Prediction.team1_powerplay < 35, Prediction.team1_powerplay > 100,
            Prediction.team2_powerplay < 35, Prediction.team2_powerplay > 100
        ))
        .group_by(User.name)
    )
    bravo_map = {name: count for name, count in bravo_res.all()}

    # 7b. Yorker King (Bumrah) - Exact matches on powerplay scores
    bumrah_res = await db.execute(
        select(User.name, func.count(Prediction.id))
        .join(User, Prediction.user_id == User.id)
        .join(Match, Prediction.match_id == Match.id)
        .where(or_(
            Prediction.team1_powerplay == Match.team1_powerplay_score,
            Prediction.team2_powerplay == Match.team2_powerplay_score
        ))
        .where(Match.status == "completed")
        .group_by(User.name)
    )
    bumrah_map = {name: count for name, count in bumrah_res.all()}

    # 7c. Heath Streak & The Wall - Consistency logic
    # Fetch all completed entries to calculate streaks
    entries_res = await db.execute(
        select(User.name, LeaderboardEntry.points)
        .join(User, LeaderboardEntry.user_id == User.id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.status == "completed")
        .where(Match.id.in_(valid_match_ids))
        .order_by(User.name, Match.id)
    )
    
    user_entries = {}
    for name, pts in entries_res.all():
        if name not in user_entries: user_entries[name] = []
        user_entries[name].append(pts)
        
    streak_map = {}
    wall_map = {}
    ht_map = {}
    dhoni_map = {}
    for name, scores in user_entries.items():
        # Longest streak of positive points
        max_streak = 0
        current_streak = 0
        for s in scores:
            if s > 0:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0
        streak_map[name] = max_streak
        
        # The Hat-Trick (Malinga) - 3 consecutive matches with 30+ pts
        max_ht = 0
        current_ht = 0
        for s in scores:
            if s >= 30:
                current_ht += 1
                max_ht = max(max_ht, current_ht)
            else:
                current_ht = 0
        ht_map[name] = max_ht

        # Captain Cool (Dhoni) - Avg of last 5 matches
        final_5 = scores[-5:]
        if len(final_5) >= 3:
            dhoni_map[name] = sum(final_5) / len(final_5)

    # 8. Hall of Fame - Find winners (handles ties)
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

    # Impact Player (Russell) - Pts from Powerplay predictions
    impact_res = await db.execute(
        select(User.name, func.sum(Prediction.points_awarded))
        .join(User, Prediction.user_id == User.id)
        .where(Prediction.points_awarded >= 10) 
        .group_by(User.name)
    )
    impact_map = {name: pts for name, pts in impact_res.all()}

    # Universe Boss logic - Highest single score
    boss_res = await db.execute(
        select(User.name, func.max(LeaderboardEntry.points))
        .join(User, LeaderboardEntry.user_id == User.id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.id.in_(valid_match_ids))
        .group_by(User.name)
    )
    boss_map = {name: pts for name, pts in boss_res.all()}

    # Chase Master (Kohli) - Rank shifts in last week
    current_ranks = {name: i+1 for i, (name, pts) in enumerate(sorted(lb_data, key=lambda x: x[1], reverse=True))}
    last_week_start = now - timedelta(days=7)
    past_lb_res = await db.execute(
        select(User.name, func.sum(LeaderboardEntry.points))
        .join(LeaderboardEntry, User.id == LeaderboardEntry.user_id)
        .join(Match, LeaderboardEntry.match_id == Match.id)
        .where(Match.toss_time < last_week_start)
        .where(Match.id.in_(valid_match_ids))
        .group_by(User.name)
        .order_by(func.sum(LeaderboardEntry.points).desc())
    )
    past_ranks = {name: i+1 for i, (name, pts) in enumerate(past_lb_res.all())}
    chase_map = {name: past_ranks[name] - curr for name, curr in current_ranks.items() if name in past_ranks and past_ranks[name] > curr}

    # Mystery Spinner (Narine) - Upset match points
    mystery_map = {}
    pts_per_match_res = await db.execute(
        select(User.name, Prediction.match_id, Prediction.points_awarded)
        .join(User, Prediction.user_id == User.id)
        .where(Prediction.points_awarded > 15)
    )
    pts_data = pts_per_match_res.all()
    match_totals = {}
    for name, mid, pts in pts_data:
        if mid not in match_totals: match_totals[mid] = []
        match_totals[mid].append(pts)
    
    for name, mid, pts in pts_data:
        avg = sum(match_totals[mid]) / len(match_totals[mid]) if match_totals[mid] else 0
        if avg < 10: # Upset match
            mystery_map[name] = mystery_map.get(name, 0) + 1

    # Switch Hit (Double Bullseye)
    switch_res = await db.execute(
        select(User.name, func.count(Prediction.id))
        .join(User, Prediction.user_id == User.id)
        .join(Match, Prediction.match_id == Match.id)
        .where(Match.status == "completed")
        .where(Prediction.team1_powerplay == Match.team1_powerplay_score)
        .where(Prediction.team2_powerplay == Match.team2_powerplay_score)
        .group_by(User.name)
    )
    switch_map = {name: count for name, count in switch_res.all()}

    # Caught and Bowled (Perfect Game)
    cb_res = await db.execute(
        select(User.name, func.count(Prediction.id))
        .join(User, Prediction.user_id == User.id)
        .join(Match, Prediction.match_id == Match.id)
        .where(Match.status == "completed")
        .where(Prediction.match_winner == Match.winner)
        .where(Prediction.player_of_the_match == Match.player_of_the_match)
        .where(or_(
            Prediction.team1_powerplay == Match.team1_powerplay_score,
            Prediction.team2_powerplay == Match.team2_powerplay_score
        ))
        .group_by(User.name)
    )
    cb_map = {name: count for name, count in cb_res.all()}

    # Hit Wicket (Powerup Fail)
    hw_res = await db.execute(
        select(User.name, func.count(Prediction.id))
        .join(User, Prediction.user_id == User.id)
        .where(Prediction.use_powerup == "Yes")
        .where(Prediction.points_awarded < 0)
        .group_by(User.name)
    )
    hw_map = {name: count for name, count in hw_res.all()}

    # Direct Hit (Jadeja) - Off by exactly 1 run
    direct_res = await db.execute(
        select(User.name, func.count(Prediction.id))
        .join(User, Prediction.user_id == User.id)
        .join(Match, Prediction.match_id == Match.id)
        .where(Match.status == "completed")
        .where(or_(
            func.abs(Prediction.team1_powerplay - Match.team1_powerplay_score) == 1,
            func.abs(Prediction.team2_powerplay - Match.team2_powerplay_score) == 1
        ))
        .group_by(User.name)
    )
    direct_map = {name: count for name, count in direct_res.all()}

    # Doosra Spinner - Most incorrect winner predictions
    doosra_res = await db.execute(
        select(User.name, func.count(Prediction.id))
        .join(User, Prediction.user_id == User.id)
        .join(Match, Prediction.match_id == Match.id)
        .where(Match.status == "completed")
        .where(Match.winner != None)
        .where(Match.winner != "Draw")
        .where(Prediction.match_winner != None)
        .where(Prediction.match_winner != Match.winner)
        .group_by(User.name)
    )
    doosra_map = {name: count for name, count in doosra_res.all()}

    # One Man Army - Sole predictor for a team in a match
    all_preds_res = await db.execute(
        select(User.name, Prediction.match_id, Prediction.match_winner)
        .join(User, Prediction.user_id == User.id)
    )
    match_winner_counts = {}
    user_predictions = []
    for name, mid, winner in all_preds_res.all():
        if not winner: continue
        user_predictions.append((name, mid, winner))
        if mid not in match_winner_counts:
            match_winner_counts[mid] = {}
        match_winner_counts[mid][winner] = match_winner_counts[mid].get(winner, 0) + 1

    army_map = {}
    for name, mid, winner in user_predictions:
        if match_winner_counts[mid][winner] == 1:
            army_map[name] = army_map.get(name, 0) + 1

    # The Big Show (Maxwell) - Max Yield from Powerup
    maxwell_res = await db.execute(
        select(User.name, func.max(Prediction.points_awarded))
        .join(User, Prediction.user_id == User.id)
        .where(Prediction.use_powerup == "Yes")
        .group_by(User.name)
    )
    maxwell_map = {name: pts for name, pts in maxwell_res.all()}

    hall_of_fame = {
        "heath_streak": get_winners(streak_map),
        "dwayne_bravo": get_winners(bravo_map),
        "yorker_king": get_winners(bumrah_map),
        "universe_boss": get_winners(boss_map),
        "the_wall": get_winners(wall_map),
        "hat_trick": get_winners(ht_map),
        "the_big_show": get_winners(maxwell_map),
        "captain_cool": get_winners(dhoni_map),
        "chase_master": get_winners(chase_map),
        "impact_player": get_winners(impact_map),
        "switch_hit": get_winners(switch_map),
        "caught_bowled": get_winners(cb_map),
        "hit_wicket": get_winners(hw_map),
        "direct_hit": get_winners(direct_map),
        "doosra_spinner": get_winners(doosra_map),
        "one_man_army": get_winners(army_map),
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
                    {"type": "kohli", "name": "Chase Master", "value": f"Up {chase_map.get(name, 0)} Ranks"} if chase_map.get(name, 0) >= 3 else None,
                    {"type": "russell", "name": "Impact Player", "value": "Powerplay King"} if impact_map.get(name, 0) >= 100 else None,
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

