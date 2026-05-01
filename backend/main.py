from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from backend.scheduler import start_scheduler, stop_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(title="IPL Fantasy API", lifespan=lifespan)

# Allow CORS for local dev and frontend URL(s)
# FRONTEND_URL can be a single URL or comma-separated list of URLs
frontend_url_raw = os.environ.get("FRONTEND_URL", "http://localhost:5173")
allowed_origins = [url.strip() for url in frontend_url_raw.split(",") if url.strip()]
# Add n8n cloud origin for webhooks if needed
allowed_origins.append("https://rasheedhere.app.n8n.cloud")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SessionMiddleware, secret_key=os.environ.get("JWT_SECRET", "session_secret"))


from backend.router import auth_router, admin_router, match_router, leaderboard_router
from backend.router import campaigns_router, external_router, league_router, campaign_results_router, tournament_router, events_router

app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(match_router.router)
app.include_router(leaderboard_router.router)
app.include_router(campaigns_router.router)
app.include_router(external_router.router)
app.include_router(league_router.router)
app.include_router(tournament_router.router)
app.include_router(campaign_results_router.router)
app.include_router(events_router.router)

@app.get("/")
async def root():
    return {"message": "IPL Fantasy API running"}
