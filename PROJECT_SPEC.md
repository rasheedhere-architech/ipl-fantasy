# IPL Fantasy Cricket — Master Project Spec & IDE Prompt

> Paste the CODING TASK sections into your AI IDE.
> Complete all MANUAL TASK steps yourself before or alongside coding — they require browser dashboards, not code.
> Choose ONE frontend section (React or Angular) and delete the other before pasting.

---

## Legend

| Symbol | Meaning |
|---|---|
| 💻 **CODING TASK** | Tell your AI IDE to build this |
| 🔧 **MANUAL TASK** | You do this yourself in a browser or terminal — no IDE needed |

---

## Project overview

A private IPL Fantasy Cricket prediction website for a friend group. Users sign in with Google (allowlist-gated), submit predictions per match, and compete on a leaderboard. After predictions lock, all users can see what everyone else predicted. An admin manages allowed users, match questions, and scoring rules.

---

## Full tech stack

| Layer | Technology |
|---|---|
| Backend | Python · FastAPI (async) |
| Database | PostgreSQL · SQLAlchemy ORM · Alembic migrations |
| Auth | Google OAuth 2.0 (Authlib) · JWT session tokens |
| Live match data | CricAPI free tier — https://cricapi.com |
| Frontend (pick one) | React 18 + Vite **or** Angular 17+ standalone |
| Styling | Tailwind CSS v3 |
| Frontend state | Zustand (React) **or** NgRx (Angular) |

---

## Hosting plan — minimal cost

| Service | Provider | Cost |
|---|---|---|
| Frontend | Vercel (React) or Firebase Hosting (Angular) | Free |
| Backend | Render Starter plan | $7/month |
| Database | Neon serverless PostgreSQL | Free (500 MB) |
| **Total** | | **~$7/month** |

---

## 🔧 MANUAL TASKS — do these yourself, before writing any code

These are one-time setup steps done in browser dashboards. Complete them in order and collect the credentials — they go into your `.env` file.

### Step 1 — Google Cloud Console (OAuth credentials)

1. Go to https://console.cloud.google.com and create a new project (e.g. "ipl-fantasy")
2. Navigate to **APIs & Services → OAuth consent screen**
   - User type: External
   - App name: IPL Fantasy · Support email: your email
   - Add scopes: `email`, `profile`, `openid`
   - Add your own email as a test user while in development
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: Web application
   - Authorised redirect URIs:
     - `http://localhost:8000/auth/callback` (local dev)
     - `https://your-backend.onrender.com/auth/callback` (add this after Render deploy in Step 5)
4. Copy **Client ID** → `GOOGLE_CLIENT_ID` and **Client Secret** → `GOOGLE_CLIENT_SECRET`

### Step 2 — Neon (PostgreSQL database)

1. Go to https://neon.tech and sign up (free)
2. Create a new project: name "ipl-fantasy", pick the region closest to you
3. Copy the **Connection string** (asyncpg format):
   `postgresql+asyncpg://user:pass@host/dbname`
4. Paste into `DATABASE_URL` in your `.env`

### Step 3 — CricAPI (live match data)

1. Go to https://cricapi.com and sign up (free tier)
2. Copy your **API key** → `CRICAPI_KEY`
3. Free tier: ~100 requests/day. The polling service only queries live/upcoming matches to stay within this limit.

### Step 4 — GitHub repository

1. Create a new **private** GitHub repo named `ipl-fantasy`
2. Push your local project to it once the IDE has scaffolded it
3. This repo drives auto-deploy for Vercel / Firebase / Render

### Step 5 — Render (backend hosting) — do after backend is built and tested locally

1. Go to https://render.com, sign up, connect your GitHub account
2. New → Web Service → select your `ipl-fantasy` repo
3. Settings:
   - Runtime: **Docker** (uses your Dockerfile)
   - Plan: **Starter ($7/month)** — required for always-on, no cold starts
   - Branch: `main`
4. In the **Environment** tab, add every variable from your `.env` file
5. After first deploy: copy your Render URL (e.g. `https://ipl-fantasy-api.onrender.com`)
6. Return to **Google Cloud Console** and add the production redirect URI:
   `https://ipl-fantasy-api.onrender.com/auth/callback`

### Step 6A — Vercel (React frontend) — do after frontend is built

1. Go to https://vercel.com, sign up with GitHub
2. New Project → import `ipl-fantasy` repo → Vercel auto-detects Vite, no config needed
3. Add environment variable: `VITE_API_URL` = your Render URL
4. Deploy. Every push to `main` auto-deploys going forward.

### Step 6B — Firebase Hosting (Angular frontend) — do after frontend is built

1. Go to https://console.firebase.google.com → Add project → select your existing Google Cloud project (same one used for OAuth — keeps everything in one place)
2. In your terminal: `npm install -g firebase-tools && firebase login`
3. In your project folder: `firebase init hosting`
   - Public directory: `dist/ipl-fantasy/browser`
   - Configure as single-page app: **Yes**
4. Run `firebase login:ci` and copy the token → add as `FIREBASE_TOKEN` in GitHub repo secrets
5. Deploy: `ng build && firebase deploy`

### Step 7 — Seed first admin — do after your first login in production

Run once to promote your account to admin:
```bash
# In Render shell, or locally pointing at the production DATABASE_URL
python seed_admin.py your@gmail.com
```

---

## 💻 CODING TASK — Environment variables

Scaffold this file. Values come from the manual steps above.

```
GOOGLE_CLIENT_ID=        # from Step 1 — Google Cloud Console
GOOGLE_CLIENT_SECRET=    # from Step 1 — Google Cloud Console
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback
JWT_SECRET=              # generate: python -c "import secrets; print(secrets.token_hex(32))"
JWT_EXPIRY_HOURS=8
DATABASE_URL=            # from Step 2 — Neon dashboard
CRICAPI_KEY=             # from Step 3 — CricAPI dashboard
FRONTEND_URL=http://localhost:5173
```

---

## 💻 CODING TASK — Backend (FastAPI)

You are helping me build the backend for an IPL Fantasy Cricket prediction website for a private friend group.

### Stack
- Python with FastAPI (async throughout)
- PostgreSQL with SQLAlchemy async ORM
- Alembic for database migrations
- Authlib for Google OAuth 2.0
- JWT access tokens (python-jose)
- APScheduler for background polling jobs
- Deployment: Dockerfile (python:3.12-slim base) → Render Starter plan
- Database: Neon free tier (standard DATABASE_URL, asyncpg driver)

### 1. Authentication — Google SSO with allowlist gate

- No username/password login. Google OAuth 2.0 is the only login method.
- OAuth flow: user clicks "Sign in with Google" → Google confirms identity → backend receives verified email
- After Google confirms identity, check if email exists in the `AllowlistedEmail` table
- If email IS on the allowlist → issue a JWT session token, auto-create `User` record on first login (name + avatar from Google profile)
- If email is NOT on the allowlist → return HTTP 403 with `{"detail": "not_invited"}`. Do NOT create a user record.
- Admin role is a boolean flag (`is_admin`) on the User model. First admin is set via `seed_admin.py` (manual task).
- No approval queue, no pending states. Allowlisted = access granted. Not allowlisted = access denied.

### 2. Admin — allowlist management

```
GET    /admin/allowlist            → list all allowlisted emails
POST   /admin/allowlist            → add one or more emails { "emails": ["a@b.com"] }
DELETE /admin/allowlist/{email}    → remove an email
GET    /admin/users                → list all users who have logged in at least once
```

### 3. Match model — seeded from CricAPI

Fields: `match_id`, `team1`, `team2`, `venue`, `toss_time` (datetime UTC), `status` (enum: upcoming | live | completed)

- APScheduler background job polls CricAPI every 5 minutes
- Only poll matches with status `upcoming` or `live` to stay within free tier (100 req/day)
- When status changes to `completed`, automatically trigger the scoring job
- Prediction lock enforced server-side: `lock_time = toss_time - 30 minutes`

### 4. Predictions

Fixed questions per match:
- `match_winner` — team name string
- `top_batter` — player name string
- `top_bowler` — player name string
- `total_sixes` — integer
- `total_fours` — integer

Custom questions (admin-created per match):
- Fields: `question_text`, `answer_type` (enum: text | number | player_name), `correct_answer` (set after match)

Prediction endpoints:
```
GET  /matches                             → list all matches
GET  /matches/{id}                        → match detail + questions
POST /matches/{id}/predictions            → submit prediction (rejected if past lock_time)
PUT  /matches/{id}/predictions            → update prediction (rejected if past lock_time)
GET  /matches/{id}/predictions/mine       → current user's predictions for a match
GET  /matches/{id}/predictions/all        → all users' predictions — only accessible AFTER lock_time
```

**Community predictions — `GET /matches/{id}/predictions/all`**
- Returns HTTP 403 `{"detail": "predictions_still_open"}` if called before `lock_time`
- After lock_time, returns all submitted predictions grouped by user:
```json
[
  {
    "user": { "id": "...", "name": "Priya", "avatar_url": "..." },
    "answers": {
      "match_winner": "MI",
      "top_batter": "Rohit Sharma",
      "total_sixes": 12
    }
  }
]
```
- Users who did not submit any predictions are excluded
- Accessible to all authenticated (allowlisted) users — not admin-only

### 5. Scoring engine

Admin defines rules as JSON stored in `ScoringRule`:

```json
{
  "match_winner":  { "type": "exact_match",   "points": 10 },
  "top_batter":    { "type": "exact_match",   "points": 15 },
  "top_bowler":    { "type": "exact_match",   "points": 15 },
  "total_sixes":   { "type": "numeric_range", "range": 2, "points": 8 },
  "total_fours":   { "type": "numeric_range", "range": 3, "points": 5 }
}
```

Formula types:
- `exact_match` — full points if answer matches exactly (case-insensitive)
- `numeric_range` — full points if within ±range of correct answer
- `partial_match` — configurable partial credit

Scoring job runs automatically when match status → `completed`.

### 6. Leaderboard

```
GET /leaderboard                    → global, sorted by total_points DESC
GET /leaderboard/match/{match_id}   → per-match rankings
```

Response fields: `rank`, `username`, `avatar_url`, `total_points`, `matches_played`, `accuracy_pct`

### 7. Admin endpoints

```
POST /admin/matches/{id}/questions         → add custom question
PUT  /admin/matches/{id}/questions/{qid}   → edit question / set correct_answer
GET  /admin/predictions/{match_id}         → view all users' predictions (no lock restriction for admin)
PUT  /admin/matches/{id}/results           → manually set correct answers + trigger scoring
PUT  /admin/scoring-rules                  → update formula config
```

### Database models

```
User             — id, google_id, email, name, avatar_url, is_admin, created_at
AllowlistedEmail — id, email, added_at
Match            — id, cricapi_match_id, team1, team2, venue, toss_time, status, raw_result_json
Question         — id, match_id, key, question_text, answer_type, correct_answer, is_fixed
Prediction       — id, user_id, match_id, question_id, answer, points_awarded, created_at
ScoringRule      — id, config_json, updated_at
LeaderboardEntry — id, user_id, match_id, points, created_at
```

### Backend build order

1. Project scaffold — folder structure, `requirements.txt`, `Dockerfile`, `.env.example`
2. Database models + Alembic initial migration
3. Google OAuth flow + allowlist gate + JWT issuance
4. `seed_admin.py` script
5. Admin allowlist endpoints
6. Match model + CricAPI polling service (APScheduler)
7. Prediction endpoints with server-side lock enforcement
8. Community predictions endpoint — `/predictions/all` with lock gate
9. Scoring engine
10. Leaderboard endpoints
11. Remaining admin endpoints
12. `README.md` with Render + Neon deploy steps

Use async FastAPI patterns throughout (`async def`, `asyncpg`, `AsyncSession`).
Dockerfile: `python:3.12-slim` base, no unnecessary layers.

---

## 💻 CODING TASK — Frontend OPTION A: React + Vite

> Delete this section if choosing Angular.

You are helping me build the React frontend for an IPL Fantasy Cricket prediction website.

### Stack
- React 18 + Vite + TypeScript
- Tailwind CSS v3 with custom IPL theme
- Zustand — global auth/user state
- TanStack Query v5 — all server state and API calls
- React Router v6
- Axios — typed API client
- Lucide React — icons

### Design theme — bold & sporty IPL

```js
// tailwind.config.ts
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

Team colours (src/utils/teamColours.ts):
MI=#004BA0 · CSK=#F4C430 · RCB=#CC0000 · KKR=#552583 · DC=#0078BC
RR=#E91E8C · PBKS=#AA0000 · SRH=#FF6600 · GT=#1B6CA8 · LSG=#00ADEF

### Pages

#### /login
- Full-screen navy background, centered card
- "Sign in with Google" button → `GET /auth/google`
- Handle redirect at `/auth/callback`, store JWT in Zustand + sessionStorage
- 403 response: show "You're not on the guest list" inline (no redirect)
- Success: navigate to /dashboard

#### /dashboard
- Nav: logo, user avatar + name, logout
- Upcoming matches: `MatchCard` list — team1 vs team2, venue, countdown, "Predict" CTA, live pulse

#### /match/:id — two distinct states

**Before lock_time — predictions open:**
- Match header + `CountdownTimer` (red <1 hour, "Locked" text when past)
- Prediction form (React Hook Form):
  - `match_winner`: two-button team selector styled with team colours
  - `top_batter`, `top_bowler`: text inputs
  - `total_sixes`, `total_fours`: number inputs
  - Custom questions: rendered dynamically, input type from `answer_type`
- Submit button + success toast + optimistic update

**After lock_time — predictions closed:**
- Read-only view of current user's submitted answers
- Score badge if match is completed
- **"What everyone predicted" section** — community predictions table:
  - One row per user who submitted, avatar + name in first column
  - One column per question showing each user's answer
  - Match completed: green highlight for correct answers, red for incorrect
  - Match live: neutral display, no highlighting
  - Empty state if nobody submitted

#### /leaderboard
- Toggle: overall season vs per-match (dropdown)
- Table: rank · avatar · username · points · matches played · accuracy %
- Current user row: gold highlight
- Top 3: gold / silver / bronze styling

#### /admin — redirect if not is_admin
- 4 tabs: Allowlist | Questions | Scoring Rules | Results
- **Allowlist**: email list, bulk-add textarea, remove per row
- **Questions**: match picker, question list, add-question form
- **Scoring rules**: points config per question key, live preview
- **Results**: match picker, correct answer inputs, "Trigger scoring" with confirm

### API client (src/api/client.ts)
- Axios instance with `VITE_API_URL` base
- Request interceptor: Bearer token from Zustand
- Response interceptor: 401 → clear auth → /login
- All response types defined in `src/types/`

### Zustand store (src/store/auth.ts)
```ts
interface AuthState {
  user: { id: string; name: string; email: string; avatar: string; is_admin: boolean } | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user, token) => void
  logout: () => void
}
// Persist token in sessionStorage only
```

### React Query hooks (src/api/hooks/)
- `useMatches()`, `useMatch(id)`, `useMyPredictions(matchId)`, `useSubmitPrediction()`
- `useCommunityPredictions(matchId)` — enabled only when `Date.now() > lock_time`
- `useLeaderboard()`, `useMatchLeaderboard(id)`
- `useAdminAllowlist()`, `useAdminUsers()`, `useAdminPredictions(matchId)`

### Deployment config
```json
// vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### File structure
```
src/
  api/          client.ts · hooks/
  components/   MatchCard · CountdownTimer · PredictionForm · CommunityPredictions · TeamBadge · Nav
  pages/        Login · Dashboard · Match · Leaderboard · Admin
  store/        auth.ts
  types/        Match · User · Prediction · CommunityPrediction · LeaderboardEntry · Question
  utils/        teamColours.ts · formatDate.ts · timeUntilLock.ts
```

### React build order
1. Vite + React + TS scaffold, Tailwind IPL theme, Inter font (Google Fonts)
2. Zustand store + Axios client with interceptors
3. Login page + `/auth/callback` handler
4. `<RequireAuth>` and `<RequireAdmin>` route wrappers
5. Dashboard — MatchCard + CountdownTimer
6. Match page — prediction form (open state) + CommunityPredictions table (locked state)
7. Leaderboard page
8. Admin panel — all 4 tabs
9. `vercel.json`

---

## 💻 CODING TASK — Frontend OPTION B: Angular 17+

> Delete this section if choosing React.

You are helping me build the Angular frontend for an IPL Fantasy Cricket prediction website.

### Stack
- Angular 17+ standalone components, TypeScript strict mode
- Tailwind CSS v3 via PostCSS
- NgRx (store + effects + selectors)
- Angular HttpClient + Router
- Lucide Angular or description SVG icons

### Design theme
Same colour tokens and team colour map as React option. Apply via `tailwind.config.ts`.

### Pages / routes

#### /login
- Dark layout, centered card, "Sign in with Google" → `/auth/google`
- Callback handler: dispatch NgRx `SetUser`, navigate to /dashboard
- 403: inline "You're not on the guest list" error

#### /dashboard
- Nav, upcoming MatchCardComponents with CountdownComponent, recent predictions, rank card

#### /match/:id — two states

**Before lock — prediction form:**
- `CountdownComponent` (red <1h, "Locked" at lock)
- Angular reactive `FormGroup` with `FormArray` for custom questions
- Fixed: match_winner (team selector), top_batter/bowler (text), sixes/fours (number)
- Submit triggers NgRx `SubmitPrediction` + optimistic update

**After lock — read-only + community predictions:**
- Read-only summary of user's answers with score badge if completed
- `CommunityPredictionsComponent`:
  - Fetches `/matches/{id}/predictions/all` via NgRx `LoadCommunityPredictions` effect
  - Table: one row per user, columns per question
  - Correct/incorrect cell highlighting when match is completed

#### /leaderboard
- Toggle overall vs per-match, styled table, gold highlight for current user, medals for top 3

#### /admin — guarded by AdminGuard
- 4-tab component: Allowlist | Questions | Scoring Rules | Results (same as React option)

### NgRx structure
```
store/
  auth/         SetUser · Logout · GoogleCallbackSuccess
  matches/      LoadMatches · LoadMatch · SubmitPrediction · LoadCommunityPredictions
  leaderboard/  LoadLeaderboard · LoadMatchLeaderboard
```

### Services (src/app/services/)
- `auth.service.ts` — `initiateGoogleLogin()`, `handleCallback()`, `logout()`
- `matches.service.ts` — `getMatches()`, `getMatch(id)`, `submitPrediction()`, `getCommunityPredictions(matchId)`
- `leaderboard.service.ts`, `admin.service.ts`

### Guards & interceptor
- `AuthGuard` — redirect /login if not authenticated
- `AdminGuard` — redirect /dashboard if not admin
- `auth.interceptor.ts` — Bearer token on all requests, 401 → dispatch Logout

### Environments
```ts
// environment.ts
export const environment = { apiUrl: 'http://localhost:8000' };
// environment.prod.ts
export const environment = { apiUrl: 'https://your-backend.onrender.com' };
```

### Firebase Hosting config
```json
// firebase.json
{
  "hosting": {
    "public": "dist/ipl-fantasy/browser",
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```
GitHub Actions: `npm ci → ng build → firebase deploy --token $FIREBASE_TOKEN` on push to main.

### File structure
```
src/app/
  components/   match-card · countdown-timer · prediction-form · community-predictions · team-badge · nav
  pages/        login · dashboard · match · leaderboard · admin
  store/        auth/ · matches/ · leaderboard/
  services/     auth · matches · leaderboard · admin
  models/       match · user · prediction · community-prediction · leaderboard-entry · question
  guards/       auth.guard.ts · admin.guard.ts
  interceptors/ auth.interceptor.ts
  utils/        team-colours.ts · format-date.ts
```

### Angular build order
1. Angular 17 scaffold, Tailwind + IPL theme, Inter font
2. NgRx store — auth slice first
3. HTTP interceptor
4. Login page + OAuth callback
5. AuthGuard + AdminGuard
6. Dashboard — MatchCardComponent + CountdownComponent
7. Match page — reactive form (open) + CommunityPredictionsComponent (locked)
8. Leaderboard page
9. Admin panel — all 4 tabs
10. `firebase.json` + GitHub Actions deploy workflow

---

## Full project checklist

### 🔧 Manual tasks — you do these

- [ ] **Step 1** — Create Google Cloud project, configure OAuth consent screen, create OAuth 2.0 credentials, copy Client ID + Secret
- [ ] **Step 2** — Create Neon project, copy `DATABASE_URL`
- [ ] **Step 3** — Sign up for CricAPI, copy API key
- [ ] **Step 4** — Create private GitHub repo, push code after scaffold
- [ ] **Step 5** — Create Render web service (Starter plan), add all env vars from `.env`, add production Google redirect URI after first deploy
- [ ] **Step 6A** — Connect GitHub to Vercel, set `VITE_API_URL` env var *(React only)*
- [ ] **Step 6B** — Create Firebase project, install CLI, `firebase init hosting`, add `FIREBASE_TOKEN` to GitHub secrets *(Angular only)*
- [ ] **Step 7** — Run `python seed_admin.py your@gmail.com` after first production login
- [ ] Add friend emails to allowlist via admin panel
- [ ] Set scoring rules in admin panel before first match

### 💻 Coding tasks — IDE builds these

- [ ] FastAPI project scaffold + Dockerfile + `.env.example`
- [ ] Database models + Alembic migrations
- [ ] Google OAuth flow + allowlist gate + JWT issuance
- [ ] `seed_admin.py` script
- [ ] Admin allowlist endpoints
- [ ] CricAPI polling service (APScheduler, poll only upcoming/live)
- [ ] Prediction endpoints with server-side lock enforcement
- [ ] Community predictions endpoint — `/predictions/all` locked before toss-30min
- [ ] Scoring engine
- [ ] Leaderboard endpoints
- [ ] Admin match/question/results/scoring-rules endpoints
- [ ] Frontend scaffold with IPL Tailwind theme
- [ ] Login page + OAuth callback handler
- [ ] Dashboard — match cards + countdown timers
- [ ] Match page — prediction form (open) + community predictions table (locked)
- [ ] Leaderboard page
- [ ] Admin panel — 4 tabs
- [ ] `vercel.json` (React) or `firebase.json` + GitHub Actions (Angular)
- [ ] README with full deploy guide
