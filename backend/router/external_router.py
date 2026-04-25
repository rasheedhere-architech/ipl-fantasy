import os
import httpx
import json
from datetime import datetime
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from backend.dependencies import get_db, oauth2_scheme, get_current_user
from backend.models import User, Match

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

router = APIRouter(prefix="/external", tags=["external"])

@router.post("/match-results")
async def post_match_results_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint for n8n or other external tools to post match results.
    Logs EVERYTHING before performing authentication to help debug.
    """
    # 1. Log Headers
    headers = dict(request.headers)
    
    # 2. Log Body
    body_bytes = await request.body()
    try:
        body_json = json.loads(body_bytes)
        body_display = json.dumps(body_json, indent=2)
    except:
        body_display = body_bytes.decode("utf-8", errors="ignore")
    
    print(f"\n[DEBUG] INCOMING REQUEST TO /external/match-results")
    print(f"Timestamp: {datetime.now()}")
    print(f"Headers: {json.dumps(headers, indent=2)}")
    print(f"Body: {body_display}\n")
    
    # 3. Robust Authentication
    token = await oauth2_scheme(request)
    if not token:
        print("[DEBUG] Auth Failed: No token found in headers")
        raise HTTPException(status_code=401, detail="No authorization token provided")

    current_user = None

    # Technique 1: Try Internal JWT (Standard Web Frontend)
    try:
        current_user = await get_current_user(token, db)
        print(f"[DEBUG] Auth Success via Internal JWT: {current_user.email}")
    except Exception:
        # Not a valid internal JWT, try Google techniques
        pass

    # Technique 2: Try Google ID Token (n8n or other tools providing JWT)
    if not current_user and GOOGLE_CLIENT_ID:
        try:
            # This handles the case where n8n sends an ID Token JWT
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
            email = idinfo.get('email')
            if email:
                result = await db.execute(select(User).where(User.email == email))
                current_user = result.scalars().first()
                if current_user:
                    print(f"[DEBUG] Auth Success via Google ID Token: {current_user.email}")
        except Exception as e:
            print(f"[DEBUG] Google ID Token check failed/skipped: {str(e)}")

    # Technique 3: Try Google Access Token (n8n standard Access Token)
    if not current_user:
        try:
            # We call Google's userinfo endpoint with the opaque access token
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if resp.status_code == 200:
                    info = resp.json()
                    email = info.get("email")
                    if email:
                        result = await db.execute(select(User).where(User.email == email))
                        current_user = result.scalars().first()
                        if current_user:
                            print(f"[DEBUG] Auth Success via Google Access Token: {current_user.email}")
        except Exception as e:
            print(f"[DEBUG] Google Access Token check failed: {str(e)}")

    # Final Authorization Evaluation
    if not current_user:
        print("[DEBUG] Auth Failed: Token could not be validated by any provider")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization failed - please check your credentials"
        )

    if not current_user.is_telegram_admin and not current_user.is_admin:
        print(f"[DEBUG] Auth Failed: User {current_user.email} is not an admin")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )

    print(f"[DEBUG] Auth Success: {current_user.email}")
    
    reporter_id = current_user.id
    authored_as_name = current_user.email
    telegram_user_to_check = body_json.get("username") if isinstance(body_json, dict) else None
    if telegram_user_to_check:
        res = await db.execute(select(User).where(User.telegram_username == telegram_user_to_check))
        target_user = res.scalars().first()
        
        if not target_user:
            print(f"[DEBUG] Auth Failed: Telegram user '@{telegram_user_to_check}' not found in database")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Telegram user '@{telegram_user_to_check}' is not registered."
            )
            
        if not target_user.is_telegram_admin and not target_user.is_admin:
            print(f"[DEBUG] Auth Failed: Telegram user '@{telegram_user_to_check}' is not an admin")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Telegram user '@{telegram_user_to_check}' does not have enough privileges."
            )
            
        print(f"[DEBUG] Telegram Validation Success: @{telegram_user_to_check} is an admin")
        reporter_id = target_user.id
        authored_as_name = f"@{target_user.telegram_username}" if target_user.telegram_username else target_user.email
    else:
        # If no username is provided, we default to the current_user's own status (already checked above)
        pass

    # 5. Process Match Results
    match_data = body_json.get("match_result")
    if match_data:
        match_id_val = str(match_data.get("match"))
        prefixed_id = f"ipl-2026-{match_id_val}" if match_id_val.isdigit() else match_id_val
        
        # Find the match (try internal ID, external_id, or the prefixed ipl-2026-ID)
        res = await db.execute(select(Match).where(
            (Match.id == match_id_val) | 
            (Match.external_id == match_id_val) |
            (Match.id == prefixed_id) |
            (Match.external_id == prefixed_id)
        ))
        match = res.scalars().first()
        
        if not match:
            print(f"[DEBUG] Processing Error: Match '{match_id_val}' not found")
            return {
                "status": "error",
                "message": f"Match {match_id_val} not found in database"
            }
            
        # Map fields from the payload
        # payload structure: {"winner": "...", "scores": {"TeamA": 60, "TeamB": 55}, "potm": "..."}
        scores = match_data.get("scores", {})
        
        if "winner" in match_data:
            match.winner = str(match_data["winner"])
        
        # Mapping of short codes to full database names
        TEAM_MAP = {
            "MI": "Mumbai Indians",
            "CSK": "Chennai Super Kings",
            "RCB": "Royal Challengers Bengaluru",
            "KKR": "Kolkata Knight Riders",
            "SRH": "Sunrisers Hyderabad",
            "RR": "Rajasthan Royals",
            "GT": "Gujarat Titans",
            "DC": "Delhi Capitals",
            "LSG": "Lucknow Super Giants",
            "PBKS": "Punjab Kings",
            "PK": "Punjab Kings"
        }
        
        # Intelligently map scores based on team names defined in the match record
        # We check both the code and the full name
        for team_code, score in scores.items():
            full_name = TEAM_MAP.get(team_code.upper(), team_code)
            
            if match.team1 == full_name or match.team1 == team_code:
                match.team1_powerplay_score = int(score)
            elif match.team2 == full_name or match.team2 == team_code:
                match.team2_powerplay_score = int(score)
            
        if "potm" in match_data:
            match.player_of_the_match = str(match_data["potm"])
            
        if "winner" in match_data:
            winner_code = str(match_data["winner"])
            match.winner = TEAM_MAP.get(winner_code.upper(), winner_code)
            
        # Save a reference to exactly what n8n sent
        match.raw_result_json = match_data
        
        # Update status and commit
        from backend.models import MatchStatus
        match.status = MatchStatus.completed
        match.reported_by = reporter_id
        match.report_method = "telegram"
        
        await db.commit()
        await db.refresh(match)
        
        print(f"[DEBUG] Match {match.id} updated via external webhook. Triggering scoring...")
        
        # Trigger the engine
        from backend.scoring import calculate_match_scores
        from backend.utils.cache import backend_cache
        
        await calculate_match_scores(match.id, db)
        
        # Invalidate caches
        backend_cache.invalidate("global_leaderboard")
        backend_cache.invalidate("match_podiums")
        backend_cache.invalidate("analysis")
        backend_cache.invalidate(f"match_leaderboard_{match.id}")
        
        return {
            "status": "success",
            "message": f"Results for Match {match_id_val} processed and scoring updated.",
            "match_id": match.id,
            "processed_results": {
                "winner": match.winner,
                "scores": {
                    match.team1: match.team1_powerplay_score,
                    match.team2: match.team2_powerplay_score,
                },
                "potm": match.player_of_the_match
            },
            "authored_as": authored_as_name,
        "chatId": body_json.get("chatId") if isinstance(body_json, dict) else None,
        }

