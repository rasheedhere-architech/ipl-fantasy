# IPL Fantasy Cricket — AI Context (GEMINI.md)

This document provides essential context for AI assistants working on the IPL Fantasy codebase. It outlines the architecture, critical business rules, and patterns used in this project.

## 🚀 Project Overview
A private IPL Fantasy prediction platform for a group of friends. Users sign in via Google, predict match outcomes, and compete on global and league-specific leaderboards.

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS v4
- **Backend**: Python 3.12 + FastAPI (Async) + SQLAlchemy 2.0 + Alembic
- **Database**: SQLite (dev) / PostgreSQL Neon (prod)
- **AI**: Gemini 2.0 Flash with Google Search Grounding (stats + result agents)
- **Automation**: n8n + Telegram for match result reporting

---

## 🏛️ Architecture & Patterns

### Backend (Python/FastAPI)
- **Async Throughout**: Use `async def` and `await` for all DB and external I/O.
- **Models**: `backend/models.py` — all SQLAlchemy models in one file.
- **Routers**: `auth_router`, `match_router`, `admin_router`, `campaigns_router`, `leaderboard_router`, `tournament_router`, `league_router`, `external_router`, `events_router`.
- **Scoring Engine**: `backend/scoring.py` (match scoring) + `backend/campaigns_scoring.py` (campaign-specific scoring).
- **Agents**: `backend/agents/match_stats_agent.py` (nightly) and `backend/agents/match_result_agent.py` (post-match).
- **Permissions**: `backend/utils/permissions.py` — RBAC helpers for league admin checks.
- **Event Bus**: `backend/utils/events.py` — `dispatch_event` utility for audit logging.

### Frontend (React/TS)
- **Tailwind CSS**: "Bold & sporty" IPL theme with custom tokens (`ipl-navy`, `ipl-gold`, `ipl-live`).
- **Team Colors**: `frontend/src/utils/teamColors.ts` (note: `teamColors.ts` not `teamColours.ts`). **Both `getTeamColor(val)` and `getTeamShortName(val)` accept `any` type** — safe against numbers or undefined values passed from dynamic answer maps.
- **State**: Zustand for auth (`src/store/auth.ts`); TanStack Query v5 for all server state (hooks in `src/api/hooks/`).
- **Layout**: `Layout.tsx` main wrapper uses `max-w-[1280px]`. Individual pages should use `w-full max-w-full` — never add inner `max-w` constraints that reduce the available width.
- **Dynamic Rendering**: `renderPredictionCard` in `MatchPage.tsx` iterates over `pred.answers` keys — **never hardcode question IDs** (`winnerQId` is the only retained special case for the team-split view).

---

## ⚖️ Critical Business Rules

### 1. Match Prediction Locking
- Predictions **lock 30 minutes before `start_time`** (UTC).
- Server-side enforcement: `lock_time = match.start_time - timedelta(minutes=30)`.
- Users cannot submit or update predictions after this time.
- **Community Reveal**: `GET /matches/{id}/predictions/all` returns HTTP 403 until the match is locked.
- **Community Reveal Segmentation**: Results are grouped by the leagues the requesting user shares with other predictors. Users only see predictions from their shared leagues (or a fallback `IPL Global` block).

### 2. Match Time Field
- The DB column is **`start_time`** (renamed from `toss_time`).
- The API returns **`tossTime`** (ISO string, used by frontend for lock/countdown) AND `start_time` (raw value).
- **Frontend always uses `match.tossTime`** for the 30-minute lock calculation and countdown timers.

### 3. Scoring System (2026 Rules)
- **Match Winner**: +10 correct, −5 incorrect.
- **Player of the Match**: +25 correct, 0 incorrect.
- **Powerplay Scores**: Exact = +15, Within ±5 = +5.
- **Sixes / Fours**: +5 correct (ties award points to all who picked either team).
- **Powerup (2× Booster)**: Multiplies Winner, POM, and Powerplay. **Does NOT multiply Sixes/Fours**. Questions can be individually exempted via `allow_powerup=False` in `CampaignQuestion`.
- **Non-participation penalty**: −5 from **Match 12 onwards**.
- **AI Assassin penalty**: Starts from **Match 25 onwards**.

### 4. Dynamic Question System
- All questions are fetched from the backend (`CampaignQuestion` table). No hardcoded question types on the frontend.
- The prediction form merges Global (Master Campaign) questions + League-specific questions.
- Backend substitutes `{{Team1}}` / `{{Team2}}` placeholders with actual team names at fetch time.
- Correct answers are stored in `CampaignMatchResult.correct_answers` (JSON keyed by `question.key`).

### 5. Campaigns
- **Master Campaign** (`is_master=True`): Global questions applied to every match. One per tournament. All users answer these.
- **League Campaigns**: Questions created by league admins. Only that league's members see and are scored on them.
- Questions support `order` field for manual reordering. Options can be sorted alphabetically via admin UI.
- `CampaignResponse.answers` is a JSON dict keyed by `question.key`.

### 6. Multi-League Architecture
- `Tournament` → `League` → `LeagueUserMapping` (M2M with `joined_at`).
- **Global League**: auto-created per tournament, all users auto-joined.
- **Private Leagues**: invite-only via `join_code`.
- **Leaderboard**: `LeaderboardCache` stores `league_id=None` (global) and per-league totals.
- **Time-Bound Scoring**: League points only count from matches/campaigns that locked after the user's `joined_at` timestamp.

### 7. Late Entrants & Powerups (Tournament Scoping)
- **Tournament Scoping**: User stats (`base_points`, `base_powerups`, `powerups_used`) are stored in `TournamentUserMapping`. This allows users to participate in multiple tournaments with separate balances.
- **Base Points Handicap**: Late entrants can be given a catch-up handicap via `TournamentUserMapping.base_points`. This adds to their total score in both Global and Private leagues.
- **Retroactive Penalty Protection**: The scoring engine skips non-participation penalties for any match that started *before* the user's `created_at` timestamp.

### 8. Platform Activity & Visibility
- **Activity Feed**: `SystemEvent` records logins, predictions, league joins, and match scoring.
- **Push Notification Ready**: The Pulse system includes `priority` (low to critical) and `target_user_id` fields, designed to drive future mobile push notifications and targeted alerts.
- **Privacy Filtering**: Regular users only see events they are involved in, events from their shared leagues, or public platform updates.
- **Global Admins**: Have unrestricted visibility into all platform activity via the `/activity` feed.

---

## 🤖 Special Users & Bots
- **AI Assassin**: `ai_assassin@ipl.fantasy` (`is_ai=True`). Non-participation penalty starts from Match 25 (not Match 12).
- **Experts**: High-performing users for comparison in "Elite Performance Splits" analytics.
- **Guests**: `is_guest=True` — can view but cannot submit predictions. Excluded from leaderboards.
- **League Admins**: `is_league_admin=True` — can manage leagues they own. Admin panel shows only their leagues.
- **Telegram Admins**: `is_telegram_admin=True` — can submit match results via n8n webhook.

---

## 🛠️ Development & Deployment

- **Match IDs**: Format `{tournament}-{year}-{number}` (e.g., `ipl-2026-42`). Bulk import accepts sequential integers (1, 2, 3) and auto-formats.
- **Webhooks**: `PUT /external/match-results` — n8n pushes Telegram-parsed results here.
- **Environment**: `.env` requires `GOOGLE_CLIENT_ID`, `DATABASE_URL`, `GEMINI_API_KEY`. `CRICAPI_KEY` is optional.
- **Migrations**: Always use `alembic revision --autogenerate -m "description"` for schema changes. For detailed workflows and troubleshooting (e.g., "revision out of sync" errors), see [backend/MIGRATIONS.md](backend/MIGRATIONS.md).
- **Dev Startup**: `./start_all.sh` — builds Docker backend + starts Vite frontend.
- **SQLite Note**: Dev database is at `backend/database_dev.db`. `ALTER TABLE ... RENAME COLUMN` requires SQLite 3.25+.

---

## 📁 Key File Locations

| File | Purpose |
|---|---|
| `backend/models.py` | All SQLAlchemy models |
| `backend/scoring.py` | Core match scoring engine |
| `backend/campaigns_scoring.py` | Campaign-specific scoring |
| `backend/router/events_router.py` | Role-aware activity feed API |
| `backend/utils/events.py` | Event dispatch utility |
| `backend/scheduler.py` | APScheduler background jobs |
| `backend/utils/permissions.py` | RBAC helpers |
| `backend/agents/match_stats_agent.py` | Gemini nightly stats fetcher |
| `backend/agents/match_result_agent.py` | Gemini post-match result fetcher |
| `backend/MIGRATIONS.md` | Database schema change guide |
| `frontend/src/utils/teamColors.ts` | IPL team color map & helpers |
| `frontend/src/store/auth.ts` | Zustand auth store |
| `frontend/src/api/client.ts` | Axios instance with auth interceptors |
| `frontend/src/pages/MatchPage.tsx` | Prediction form + community reveal |
| `frontend/src/components/SocialFeed.tsx` | Glassmorphic activity feed component |
| `frontend/src/components/Layout.tsx` | App shell, nav, main width constraint |
| `migrations/versions/` | All Alembic migration files |

---

## 📝 Current State (as of 2026-05-01)

- **Platform Activity Feed**: Fully implemented with role-based visibility and premium glassmorphic UI.
- **Tournament Scoping**: Successfully migrated user stats (`base_points`, `base_powerups`) to `TournamentUserMapping`.
- **Campaign Fairness**: Added `allow_powerup` toggle to `CampaignQuestion` to allow bonus questions exempt from boosters.
- **Multi-league architecture**: Fully implemented.
- **Dynamic frontend**: `renderPredictionCard` and match results section are fully dynamic.
- **Hall of Fame**: Sixster and Fourster badges implemented.
- **Bulk Match Import**: Admin can upload CSV to create matches in bulk.
- **All MD docs updated**: GEMINI.md, README.md, PROJECT_SPEC.md.

---

*Last Updated: 2026-05-01*
