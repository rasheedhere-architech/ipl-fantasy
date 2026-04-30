import re

with open("backend/router/auth_router.py", "r") as f:
    content = f.read()

# Replace get_me
get_me_orig = """async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "avatar": user.avatar_url,
        "is_admin": user.is_admin,
        "is_guest": user.is_guest,
        "is_telegram_admin": user.is_telegram_admin
    }"""
get_me_new = """async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    is_league_admin = False
    if not user.is_admin:
        res = await db.execute(select(LeagueAdminMapping).where(LeagueAdminMapping.user_id == user.id))
        is_league_admin = res.scalars().first() is not None

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "avatar": user.avatar_url,
        "is_admin": user.is_admin,
        "is_guest": user.is_guest,
        "is_telegram_admin": user.is_telegram_admin,
        "is_league_admin": is_league_admin or user.is_admin
    }"""
content = content.replace(get_me_orig, get_me_new)

# Replace dev_login return
dev_login_ret_orig = """        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar": user.avatar_url,
            "is_admin": user.is_admin,
            "is_guest": user.is_guest,
            "is_telegram_admin": user.is_telegram_admin,
        },"""
dev_login_ret_new = """        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar": user.avatar_url,
            "is_admin": user.is_admin,
            "is_guest": user.is_guest,
            "is_telegram_admin": user.is_telegram_admin,
            "is_league_admin": (role == "league-admin") or user.is_admin,
        },"""
content = content.replace(dev_login_ret_orig, dev_login_ret_new)

# Replace auth_callback return
auth_cb_ret_orig = """        return {
            "token": jwt_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "avatar": user.avatar_url,
                "is_admin": user.is_admin,
                "is_guest": user.is_guest,
                "is_telegram_admin": user.is_telegram_admin,
            }
        }"""
auth_cb_ret_new = """        is_league_admin = False
        if not user.is_admin:
            res = await db.execute(select(LeagueAdminMapping).where(LeagueAdminMapping.user_id == user.id))
            is_league_admin = res.scalars().first() is not None

        return {
            "token": jwt_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "avatar": user.avatar_url,
                "is_admin": user.is_admin,
                "is_guest": user.is_guest,
                "is_telegram_admin": user.is_telegram_admin,
                "is_league_admin": is_league_admin or user.is_admin,
            }
        }"""
content = content.replace(auth_cb_ret_orig, auth_cb_ret_new)

with open("backend/router/auth_router.py", "w") as f:
    f.write(content)
