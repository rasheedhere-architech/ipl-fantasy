import json
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from backend.dependencies import get_telegram_admin
from backend.models import User

router = APIRouter(prefix="/external", tags=["external"])

@router.post("/match-results")
async def post_match_results_webhook(
    request: Request,
    current_user: User = Depends(get_telegram_admin)
):
    """
    Endpoint for n8n or other external tools to post match results.
    Invokable only by users with 'is_telegram_admin' or 'is_admin' privileges.
    """
    body = await request.json()
    
    # Log the full request payload for debugging
    print(f"\n[RECEIVED WEBHOOK PAYLOAD]")
    print(f"Timestamp: {datetime.now()}")
    print(f"Invoked by: {current_user.email}")
    print(f"--- START PAYLOAD ---")
    print(json.dumps(body, indent=2))
    print(f"--- END PAYLOAD ---\n")
    
    return {
        "status": "success",
        "message": "Payload received and logged",
        "received_body": body
    }
