import re

with open("backend/router/campaigns_router.py", "r") as f:
    code = f.read()

# Replace get_current_admin with get_current_user in the endpoints
# But wait, it's safer to just replace specific lines or write it specifically.

