import os
import uuid
from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.database import get_db
from backend.models import User, AllowlistedEmail
from backend.auth import oauth, create_access_token
from backend.dependencies import get_current_user
from backend.utils.cache import backend_cache

router = APIRouter()

@router.get("/auth/google")
async def login_via_google(request: Request):
    # Clear any old piled-up session states so we don't blow past the 4096 Byte Browser Cookie Limit.
    request.session.clear()
    
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback")
    print("--- LOGIN VIA GOOGLE ---")
    print("Pre-Session:", request.session)
    response = await oauth.google.authorize_redirect(request, redirect_uri)
    print("Post-Session:", request.session)
    return response

@router.get("/auth/callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    print("--- AUTH CALLBACK ---")
    print("Cookies:", request.cookies)
    print("Session:", request.session)
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        if not user_info:
            raise HTTPException(status_code=400, detail="Missing user info in token")
            
        email = user_info.get("email")
        
        # 1. Check Allowlist
        is_allowed = False
        cached_allowlist = backend_cache.get("allowlist")
        if cached_allowlist:
            is_allowed = any(entry.email == email for entry in cached_allowlist)
        else:
            result = await db.execute(select(AllowlistedEmail).where(AllowlistedEmail.email == email))
            entry = result.scalars().first()
            is_allowed = entry is not None
            
        if not is_allowed:
            # If email is not on allowlist
            return RedirectResponse(url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:5173')}/login?error=not_invited")
            
        # 2. Upsert User using google_id
        google_id = user_info.get("sub")
        name = user_info.get("name")
        avatar_url = user_info.get("picture")
        
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if not user:
            # Create user on first login
            user = User(
                id=str(uuid.uuid4()),
                google_id=google_id,
                email=email,
                name=name,
                avatar_url=avatar_url
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
        # 3. Issue JWT Session Token
        jwt_token = create_access_token(data={"sub": user.id})
        
        # Redirect back to frontend with Token (frontend handles parsing)
        # Assuming frontend grabs ?token=... and saves it to Zustand
        return RedirectResponse(url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:5173')}/auth/callback?token={jwt_token}")
        
    except Exception as e:
        print(f"Auth error: {e}")
        return RedirectResponse(url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:5173')}/login?error=auth_failed")

@router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "avatar": user.avatar_url,
        "is_admin": user.is_admin
    }
