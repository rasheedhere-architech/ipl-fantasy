import json
from datetime import datetime
from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.dependencies import get_db, oauth2_scheme, get_current_user
from backend.models import User

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
    
    # 3. Manual Authentication
    token = await oauth2_scheme(request)
    if not token:
        print("[DEBUG] Auth Failed: No token found in headers")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization failed - please check your credentials"
        )
    
    try:
        current_user = await get_current_user(token, db)
        if not current_user.is_telegram_admin and not current_user.is_admin:
            print(f"[DEBUG] Auth Failed: User {current_user.email} is not an admin")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The user doesn't have enough privileges"
            )
    except HTTPException as e:
        print(f"[DEBUG] Auth Failed: {e.detail}")
        raise e
    except Exception as e:
        print(f"[DEBUG] Auth Failed: Unexpected error {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization failed - please check your credentials"
        )

    print(f"[DEBUG] Auth Success: {current_user.email}")
    
    # Process the body
    return {
        "status": "success",
        "message": "Payload received and logged",
        "received_body": body_json if 'body_json' in locals() else body_display
    }
