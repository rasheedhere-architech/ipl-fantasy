# IPL Fantasy Cricket — AI Context (GEMINI.md)

This document provides essential context for AI assistants working on the IPL Fantasy codebase. It outlines the architecture, critical business rules, and patterns used in this project.

## 🚀 Project Overview
A private IPL Fantasy prediction platform for a group of friends. Users sign in via Google, predict match outcomes, and compete on a global leaderboard.

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Python + FastAPI (Async) + SQLAlchemy + Alembic
- **Database**: PostgreSQL (Neon Serverless)
- **Automation**: n8n + Telegram for match result reporting

---

## 🏛️ Architecture & Patterns

### Backend (Python/FastAPI)
- **Async Throughout**: Use `async def` and `await` for all DB and external I/O.
- **Models**: Located in `backend/models.py`.
- **Routers**: Organized by domain (`admin_router`, `match_router`, `external_router`).
- **Scoring Engine**: `backend/scoring.py` handles point calculations and leaderboard updates.

### Frontend (React/TS)
- **Tailwind CSS**: Strict adherence to the "bold & sporty" theme.
- **Team Themes**: Centralized in `frontend/src/utils/teamColours.ts`. Use these for dynamic UI styling (headers, badges).
- **State Management**: Zustand for auth; TanStack Query for server state.
- **Components**: Functional components with hooks.

---

## ⚖️ Critical Business Rules

### 1. Match Prediction Locking
- Predictions **lock 30 minutes before the toss time** (UTC).
- Server-side enforcement: `lock_time = toss_time - 30 minutes`.
- Users cannot submit or update predictions after this time.
- **Community Reveal**: `GET /matches/{id}/predictions/all` is HTTP 403 until the match is locked.

### 2. Scoring System (2026 Rules)
- **Match Winner**: +10 for correct, -5 for incorrect.
- **Player of the Match**: +25 for correct, 0 for incorrect.
- **Powerplay Scores**: Bingo (exact) = 15 pts, Range (±5) = 5 pts.
- **Sixes/Fours**: +5 for correct (Ties award points to everyone who picked a team).
- **Powerups**: 2x multiplier applied to Winner, POM, and Powerplay scores. Sixes/Fours are NOT NOT multiplied.
- **Penalties**: 
    - **Match 12 onwards**: -5 points for non-participation.
    - **AI Bot (ai_assassin)**: Penalty starts only from **Match 25** onwards.

### 3. Campaigns
- Admins can create custom "Campaigns" with multiple-choice questions.
- Questions support an `order` field for manual reordering.
- Support for "Multiple Choice" with configurable selection caps and point tiers.

---

## 🤖 Special Users & Bots
- **AI Assassin**: `ai_assassin@ipl.fantasy` (is_ai=True). This bot needs special handling in scoring (Match 25 threshold).
- **Experts**: High-performing bots/users used for comparison in "Elite Performance Splits".
- **Guests**: `is_guest=True` users are excluded from the main leaderboard.
- **AI Agents**: 
    - **Match Stats Agent**: Fetches nightly head-to-head, team form, and "players to watch" using **Gemini 2.0 Flash with Search Grounding**. Stores data in `MatchStats` table.
    - **Match Result Agent**: Automatically fetches ground truth (winner, POM, scores) using **Gemini 2.0 Flash with Search Grounding** after a match status changes to `completed`.

---

## 🛠️ Development & Deployment
- **Match IDs**: Follow the format `ipl-2026-{number}` (e.g., `ipl-2026-12`).
- **Webhooks**: `POST /external/match-results` is used by n8n to push Telegram-parsed results.
- **Environment**: `.env` requires `GOOGLE_CLIENT_ID`, `DATABASE_URL`, and `CRICAPI_KEY`.
- **Migrations**: Always use `alembic revision --autogenerate` for schema changes.

---

## 📝 Recent Context
- **League Management**: Transitioning to a multi-league architecture (see `league_management_plan.md`).
- **Hall of Fame**: Adding "Sixster" and "Fourster" badges based on prediction accuracy.
- **Admin**: Campaign questions can be sorted alphabetically or manually reordered.

---

*Last Updated: 2026-04-26*
