# IPL Fantasy Cricket — Project Specification (Implemented)

> This document describes the **current, implemented** state of the platform as of April 2026.

---

## Project Overview

A private IPL Fantasy Cricket prediction website for a friend group. Users sign in with Google (allowlist-gated), submit predictions per match, and compete on leaderboards scoped to their leagues. An admin manages users, campaigns, match results, and scoring rules. Predictions lock 30 minutes before `start_time`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 · FastAPI (async) · Uvicorn |
| Database | SQLite (dev) · PostgreSQL/Neon (prod) · SQLAlchemy 2.0 Async · Alembic |
| Auth | Google OAuth 2.0 · JWT (python-jose) |
| AI | Gemini 2.0 Flash with Google Search Grounding |
| Automation | APScheduler · n8n · Telegram |
| Frontend | React 18 · Vite · TypeScript |
| Styling | Tailwind CSS v4 · Custom IPL design tokens |
| State | Zustand (auth) · TanStack Query v5 (server data) |

---

## Environment Variables (`.env`)

```env
GOOGLE_CLIENT_ID=          # Google Cloud Console
GOOGLE_CLIENT_SECRET=      # Google Cloud Console
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback
JWT_SECRET=                # python -c "import secrets; print(secrets.token_hex(32))"
JWT_EXPIRY_HOURS=8
DATABASE_URL=sqlite+aiosqlite:///backend/database_dev.db
GEMINI_API_KEY=            # Google AI Studio
CRICAPI_KEY=               # cricapi.com (optional, for live data polling)
FRONTEND_URL=http://localhost:5173
```

---

## Backend (FastAPI)

### Authentication Flow
1. User clicks "Sign in with Google" → `GET /auth/google`
2. Google confirms identity → `GET /auth/callback`
3. Backend checks `AllowlistedEmail` table:
   - ✅ On allowlist → issue JWT, auto-create `User` on first login
   - ❌ Not on allowlist → HTTP 403 `{"detail": "not_invited"}`
4. JWT stored in client `sessionStorage` and sent as `Authorization: Bearer <token>`

### Key Models

```
User               id, google_id, email, name, avatar_url, is_admin, is_guest, is_ai,
                   is_league_admin, is_telegram_admin, base_points, base_powerups
AllowlistedEmail   id, email, added_at
Tournament         id, name, status, starts_at, ends_at, master_campaign_id
Match              id, team1, team2, venue, start_time, status, tournament_id,
                   winner, raw_result_json, reported_by, report_method
League             id, name, tournament_id, join_code, is_global
LeagueUserMapping  user_id, league_id, joined_at
LeagueAdminMapping user_id, league_id
Campaign           id, name, tournament_id, league_id (nullable), is_master,
                   starts_at, ends_at, max_selections, parent_campaign_id
CampaignQuestion   id, campaign_id, key, question_text, answer_type, options (JSON),
                   scoring_rules (JSON), order, source_name
CampaignResponse   id, user_id, campaign_id, match_id, answers (JSON), submitted_at
CampaignMatchResult id, campaign_id, match_id, correct_answers (JSON)
LeaderboardEntry   user_id, match_id, points, points_breakdown (JSON), league_id (nullable)
LeaderboardCache   user_id, tournament_id, league_id (nullable), total_points
MatchStats         match_id, stats_json (AI-generated)
```

### Scoring Rules (2026)

Defined in `scoring_rules` JSON per `CampaignQuestion`:

```json
{ "type": "exact_match", "points": 10, "wrong_points": -5 }
{ "type": "difference", "thresholds": [{"diff": 0, "points": 15}, {"diff": 5, "points": 5}] }
{ "type": "multi_choice", "correct_keys": ["MI"], "points": 5 }
```

**Rule types**: `exact_match`, `difference`, `multi_choice`

**Powerup (2× Booster)**: Applied to Winner, POM, and Powerplay categories. **Not** applied to Sixes/Fours.

**Non-participation penalty**: −5 pts from Match 12 onwards (Match 25 for AI Assassin).
**Late Entrants**:
- Receive a starting inventory of `User.base_powerups` (default 10) valid globally.
- Immune to non-participation penalties for any match that started before their `created_at` timestamp.
- Can be granted a `User.base_points` handicap that contributes to both Global and Private League scores.

### Prediction Lock

Server-side: `lock_time = start_time - 30 minutes`. Enforced on `POST /matches/{id}/predictions`, `PUT`, and `GET /matches/{id}/predictions/all`.

### Community Reveal

`GET /matches/{id}/predictions/all` returns league-segmented predictions after lock:

```json
[
  {
    "league": { "id": "league-abc123", "name": "The Legends" },
    "predictions": [
      {
        "prediction_id": "uuid",
        "user": { "id": "...", "name": "Rasheed", "avatar_url": "..." },
        "answers": {
          "match_winner_abc123": "MI",
          "pp_team1_abc123": 54,
          "league_q_def456": "Virat Kohli"
        },
        "is_auto_predicted": false,
        "points_awarded": 35,
        "points_breakdown": { "rules": [...], "powerup": { "used": true } }
      }
    ]
  }
]
```

---

## Frontend (React + Vite)

### Pages

| Route | Page | Description |
|---|---|---|
| `/login` | `Login.tsx` | Google OAuth entry |
| `/` | `MatchCenter.tsx` | Today's matches + upcoming |
| `/match/:id` | `MatchPage.tsx` | Prediction form + community reveal |
| `/leaderboard` | `Leaderboard.tsx` | Multi-league standings |
| `/campaigns` | `Campaigns.tsx` | Active campaign list |
| `/campaign/:id` | `CampaignPage.tsx` | Campaign submission form |
| `/leagues` | `Leagues.tsx` | User's leagues |
| `/admin` | `Admin.tsx` | Full admin panel |
| `/admin/campaign-builder/:id?` | `CampaignBuilder.tsx` | Campaign creator |

### Design Tokens

```ts
// Tailwind config
colors: {
  ipl: {
    navy:    '#0B0E1A',
    gold:    '#F4C430',
    green:   '#00C896',
    live:    '#E84040',
    surface: '#161B2E',
  }
}
```

```ts
// frontend/src/utils/teamColors.ts
teamColors = {
  MI: '#004BA0', CSK: '#F4C430', RCB: '#CC0000', KKR: '#552583',
  DC: '#0078BC', RR: '#E91E8C', PBKS: '#AA0000', SRH: '#FF6600',
  GT: '#1B6CA8', LSG: '#00ADEF'
}
```

Both `getTeamColor(val)` and `getTeamShortName(val)` accept `any` type — safe against numbers or undefined.

### Key Patterns

- **Dynamic Prediction Cards**: `renderPredictionCard` in `MatchPage.tsx` iterates over `pred.answers` keys. No hardcoded question IDs (`winnerQId` only retained for the team split view).
- **League-Scoped Reveal**: `useAllMatchPredictions()` fetches the league-segmented response. `MatchPage` renders one reveal block per section.
- **tossTime for Locking**: Frontend uses `match.tossTime` (ISO string returned by API) to compute the 30-min lock threshold.
- **Full-Width Layout**: `Layout.tsx` main wrapper is `max-w-[1280px]`. All page containers use `w-full max-w-full` to avoid inner constraints.

### Auth Flow

```ts
// Zustand store (auth.ts)
interface AuthState {
  user: { id: string; name: string; email: string; avatar_url: string;
          is_admin: boolean; is_guest: boolean; is_league_admin: boolean } | null
  token: string | null
  setUser: (user, token) => void
  logout: () => void
}
// Persisted in sessionStorage
```

---

## AI Agents

### Match Stats Agent (`backend/agents/match_stats_agent.py`)
- Runs nightly via APScheduler.
- Uses Gemini 2.0 Flash with Google Search grounding.
- Fetches: head-to-head record, team form (last 5), players to watch (2026 season stats).
- Stores structured JSON in `MatchStats.stats_json`.
- Displayed in `MatchPage.tsx` as collapsible "Match Preview" section.

### Match Result Agent (`backend/agents/match_result_agent.py`)
- Triggered when a match status changes to `completed`.
- Uses Gemini 2.0 Flash with Google Search grounding.
- Fetches: winner, POM, Team 1/2 powerplay scores, more sixes team, more fours team.
- Admin can accept or override the fetched results.

---

## Automation (n8n + Telegram)

1. Admin sends formatted result to a Telegram bot.
2. n8n webhook receives message → parses it.
3. `PUT /external/match-results` called with Bearer token.
4. Backend validates `is_telegram_admin`, finds match, updates results, triggers scoring.

---

## Match ID Format

`{tournament}-{year}-{number}` e.g. `ipl-2026-42`

Bulk import accepts sequential integers (1, 2, 3) and auto-formats to `ipl-2026-1`, etc. Required CSV columns: `id, team1, team2, venue, toss_time`.

---

## Deployment (Quick Reference)

| Service | Provider |
|---|---|
| Backend | Docker Compose locally · Render (prod) |
| Database | SQLite locally · Neon PostgreSQL (prod) |
| Frontend | Vite dev server locally · Vercel (prod) |

```bash
# Local
./start_all.sh

# Production migrations
docker compose exec backend alembic upgrade head
```

---

*Last Updated: 2026-04-30*
