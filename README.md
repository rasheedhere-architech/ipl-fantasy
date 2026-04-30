# IPL Fantasy 2026 — Premium Prediction Platform

A sophisticated, private IPL Fantasy Cricket prediction platform for competitive friend groups. Features a robust FastAPI backend, a high-performance React frontend, multi-league architecture, dynamic AI-powered campaigns, and automated match result processing.

---

## 🌟 Key Features

### 🏆 Multi-League & Campaign System
- **Tournament-Based Architecture**: Matches belong to a Tournament (e.g., IPL 2026). Multiple private Leagues exist within each Tournament.
- **Dynamic Campaigns**: Admins create "Master" (global) or league-specific campaigns with flexible question types.
- **Rich Question Types**: Multiple choice, toggle, dropdown, free text, numeric inputs with configurable scoring tiers.
- **Advanced Scoring**: Per-question scoring rules (exact match, numeric difference, multi-choice tiers).
- **League-Scoped Reveal**: Community predictions are segmented by league — users only see predictions from members of their shared leagues.

### 🎮 Gamification & AI
- **AI Assassin**: Autonomous competitor (`ai_assassin@ipl.fantasy`) that makes heuristic predictions. Non-participation penalty starts from Match 25 onwards.
- **Powerups**: 2× score multiplier applicable to Winner, Player of the Match, and Powerplay predictions. Sixes/Fours categories are excluded from the multiplier.
- **Match Center**: Unified dashboard with today's matches, upcoming fixtures, and a live indicator.
- **Hall of Fame**: "Sixster" and "Fourster" badges awarded to users with high accuracy on team prediction categories.

### 📊 Performance Analytics
- **Visual Insights**: Stacked bar charts showing match vs. base points progression.
- **Elite Performance Split**: Comparison against experts and top performers.
- **Dynamic Community Reveal**: All predictions are revealed once lock time passes, grouped into "Team 1 Supporters" vs "Team 2 Supporters" columns on desktop.
- **Match Scores in Reveal**: Post-match, each user's points awarded (with breakdown tooltip) are shown directly on the prediction card.

### 🤖 Automation & AI Agents
- **Match Stats Agent**: Fetches nightly head-to-head stats, team form, and "players to watch" using Gemini 2.0 Flash with Google Search grounding.
- **Match Result Agent**: Auto-fetches ground truth (winner, POM, scores) when a match status changes to `completed`.
- **n8n + Telegram**: Secure webhook for automated match result ingestion and scoring triggers.

### 🛠 Admin Tools
- **Bulk Match Import**: Upload a CSV to import multiple matches at once. Format: `id,team1,team2,venue,start_time` (sequential IDs 1, 2, 3 are auto-formatted to `tournament-year-number`).
- **Campaign Builder**: Create campaigns with drag-and-drop question ordering, alphabetical option sorting, and configurable selection caps.
- **League Management**: Create leagues, assign admins, manage members, and generate join codes.
- **Manual Results Override**: Set correct answers per question and trigger scoring from the admin panel.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12 · FastAPI (Async) · Uvicorn |
| **Database** | SQLite (dev) / PostgreSQL Neon (prod) · SQLAlchemy 2.0 Async · Alembic |
| **Frontend** | React 18 · Vite · TypeScript |
| **Styling** | Tailwind CSS v4 · Custom IPL theme |
| **State Management** | Zustand (Auth) · TanStack Query v5 (Server State) |
| **Auth** | Google OAuth 2.0 · JWT |
| **AI** | Gemini 2.0 Flash with Search Grounding |
| **Automation** | n8n · APScheduler |
| **Infrastructure** | Docker Compose (backend) · Vite dev server (frontend) |

---

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for frontend dev server)
- Google Cloud Project (OAuth credentials)

### 1. Clone & Configure
```bash
git clone <repo>
cd ipl-fantasy
cp .env.example .env
# Fill in: GOOGLE_CLIENT_ID, DATABASE_URL, GEMINI_API_KEY
```

### 2. Start Everything
```bash
./start_all.sh
# Backend:  http://localhost:8000
# Frontend: http://localhost:5173
```

The script:
1. Builds and starts the backend in Docker (with hot-reload via watchfiles)
2. Runs `npm run build` to verify TypeScript, then starts the Vite dev server

### 3. Seed Initial Data
```bash
# Seed the first admin user
docker compose exec backend python seed_admin.py your-email@gmail.com

# (Optional) Seed the AI Assassin competitor
docker compose exec backend python seed_ai.py

# (Optional) Seed match schedule
docker compose exec backend python seed_matches.py
```

### 4. Database Migrations
```bash
# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Generate a new migration after model changes
docker compose exec backend alembic revision --autogenerate -m "describe change"
```

---

## 📁 Project Structure

```text
ipl-fantasy/
├── backend/
│   ├── router/
│   │   ├── auth_router.py          # Google OAuth, JWT issuance
│   │   ├── match_router.py         # Matches, predictions, community reveal
│   │   ├── admin_router.py         # Admin-only endpoints
│   │   ├── campaigns_router.py     # Campaign CRUD and submissions
│   │   ├── leaderboard_router.py   # Global & league leaderboards, analytics
│   │   ├── tournament_router.py    # Tournament & bulk match import
│   │   ├── league_router.py        # League creation, joining, management
│   │   └── external_router.py      # n8n webhook endpoint
│   ├── agents/
│   │   ├── match_stats_agent.py    # Gemini Search: nightly stats fetch
│   │   └── match_result_agent.py   # Gemini Search: auto-fetch results
│   ├── models.py                   # SQLAlchemy models (all tables)
│   ├── scoring.py                  # Core scoring engine
│   ├── campaigns_scoring.py        # Campaign-specific scoring logic
│   ├── scheduler.py                # APScheduler background jobs
│   └── utils/
│       └── permissions.py          # RBAC helpers
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── client.ts           # Axios instance with auth interceptors
│       │   └── hooks/              # TanStack Query hooks per domain
│       ├── components/
│       │   ├── Layout.tsx          # App shell, nav, outlet
│       │   ├── MatchCard.tsx       # Match list card with countdown
│       │   ├── LeaderboardSection.tsx
│       │   └── CountdownTimer.tsx
│       ├── pages/
│       │   ├── MatchCenter.tsx     # Today's matches + upcoming
│       │   ├── MatchPage.tsx       # Prediction form + community reveal
│       │   ├── Leaderboard.tsx     # Global + league standings
│       │   ├── Campaigns.tsx       # Active campaigns list
│       │   ├── CampaignPage.tsx    # Campaign submission form
│       │   ├── CampaignBuilder.tsx # Admin campaign creator
│       │   ├── Leagues.tsx         # User's leagues list
│       │   ├── Admin.tsx           # Full admin panel
│       │   └── Login.tsx           # Google OAuth login
│       ├── store/
│       │   └── auth.ts             # Zustand auth store
│       └── utils/
│           └── teamColors.ts       # IPL team color map & helpers
├── migrations/
│   └── versions/                   # Alembic migration files
├── seed_admin.py                   # Seed first admin user
├── seed_ai.py                      # Seed AI Assassin competitor
├── seed_matches.py                 # Seed match schedule
├── start_all.sh                    # One-command dev startup
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── GEMINI.md                       # AI context file (for AI assistants)
```

---

## ⚖️ Scoring Rules (2026 Season)

| Category | Correct | Incorrect |
|---|---|---|
| Match Winner | +10 | −5 |
| Player of the Match | +25 | 0 |
| Powerplay Score (exact) | +15 | — |
| Powerplay Score (±5 range) | +5 | — |
| More Sixes / More Fours | +5 | 0 |
| Non-participation (Match 12+) | — | −5 |
| AI Assassin penalty starts | — | Match 25 |

**Powerup (2× Booster)**: Multiplies Winner, POM, and Powerplay points. Does **not** multiply Sixes/Fours.

---

## 🔑 Key Business Rules

- **Prediction Lock**: 30 minutes before `start_time`. Enforced server-side.
- **Community Reveal**: `GET /matches/{id}/predictions/all` returns HTTP 403 until predictions are locked. Results are segmented by the leagues the requesting user shares with others.
- **Dynamic Questions**: The prediction form and reveal both render questions dynamically from the backend. No hardcoded question IDs on the frontend.
- **Match ID Format**: `tournament-year-number` (e.g., `ipl-2026-42`). Admin bulk import accepts sequential numbers (1, 2, 3) and auto-formats them.

---

## 🔒 Security & Access Control

- **Allowlist Gate**: Only pre-approved emails can log in (Google OAuth).
- **Role Hierarchy**: Super Admin → League Admin → Member → Guest.
- **Guest Mode**: `is_guest=True` users can view but cannot submit predictions. Excluded from the main leaderboard.
- **Telegram Admins**: Users with `is_telegram_admin=True` can submit results via the n8n webhook.

---

## 🧰 Maintenance Scripts

| Script | Purpose |
|---|---|
| `seed_admin.py` | Promote an email to super admin |
| `seed_ai.py` | Create the AI Assassin competitor |
| `seed_matches.py` | Populate match schedule |
| `reset_and_seed.py` | **WIPES** database, then re-seeds everything |
| `backfill_ai_assassin.py` | Retroactively add AI Assassin predictions |
| `recalculate_all_breakdowns.py` | Recompute point breakdowns for all entries |
| `backend/scripts/recalculate_leaderboards.py` | Rebuild the `LeaderboardCache` table |

---

Developed with ❤️ for the IPL 2026 season.