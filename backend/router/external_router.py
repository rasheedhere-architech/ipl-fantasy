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
from backend.models import User

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
    
    # 4. Telegram Username Validation
    # We verify that the 'username' provided in the payload belongs to a registered admin.
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
    else:
        # If no username is provided, we default to the current_user's own status (already checked above)
        pass

    # Process the body
    return {
        "status": "success",
        "message": "Payload received and validated",
        "authorized_as": current_user.email,
        "telegram_user": telegram_user_to_check,
        "received_body": body_json if 'body_json' in locals() else body_display,
        "chatId": body_json.get("chatId") if isinstance(body_json, dict) else None
    }
