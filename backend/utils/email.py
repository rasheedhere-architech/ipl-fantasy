import os
import httpx
import asyncio
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

async def send_prediction_confirmation(user_email, user_name, match_title, predictions_dict):
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY not found in environment, skipping email.")
        return

    sender = os.getenv("EMAIL_FROM", "onboarding@resend.dev")
    brand_color = "#F4C430" # IPL Gold

    # Custom styling for the email
    html_content = f"""
    <div style="background-color: #0B0E1A; color: white; padding: 40px; font-family: sans-serif; border-radius: 8px;">
        <h1 style="color: {brand_color}; margin-bottom: 24px; border-bottom: 2px solid #1B2132; padding-bottom: 12px;">PREDICTION LOCKED 🔒</h1>
        <p>Hi {user_name},</p>
        <p>Your prediction for the match <strong>{match_title}</strong> has been successfully recorded and locked for scoring.</p>
        
        <div style="background-color: #1B2132; padding: 20px; border-radius: 4px; margin: 24px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Match Winner:</strong> {predictions_dict.get('match_winner')}</p>
            <p style="margin: 10px 0;"><strong>Powerplay Scores:</strong> {predictions_dict.get('team1_powerplay')} vs {predictions_dict.get('team2_powerplay')}</p>
            <p style="margin: 10px 0;"><strong>Player of the Match:</strong> {predictions_dict.get('player_of_the_match')}</p>
            <p style="margin: 10px 0;"><strong>Boost Used:</strong> {predictions_dict.get('use_powerup', 'No') == 'Yes' and '⚡ 2X POWERUP' or 'No'}</p>
        </div>

        <p style="font-size: 12px; color: #64748b;">Submitted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        <hr style="border: 0; border-top: 1px solid #1B2132; margin-top: 32px;" />
        <p style="font-size: 10px; color: #475569;">Good luck! May your strategy prevail.</p>
    </div>
    """

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": f"IPL Fantasy <{sender}>",
                    "to": [user_email],
                    "subject": f"Locked: {match_title} Prediction",
                    "html": html_content
                }
            )
            if response.status_code >= 400:
                logger.error(f"Resend API Error: {response.text}")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
