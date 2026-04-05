from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv

from contextlib import asynccontextmanager
app = FastAPI(title="IPL Fantasy API")

app.add_middleware(SessionMiddleware, secret_key=os.environ.get("JWT_SECRET", "session_secret"))

# Allow CORS for local dev and frontend URL
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.router import auth_router, admin_router, match_router, leaderboard_router

app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(match_router.router)
app.include_router(leaderboard_router.router)

@app.get("/")
async def root():
    return {"message": "IPL Fantasy API running"}
