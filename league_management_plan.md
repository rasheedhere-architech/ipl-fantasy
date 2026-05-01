# IPL Fantasy — League Management System

Status of the multi-league, multi-tournament architecture implementation.

---

## Architecture Overview

```
Tournament (e.g., IPL 2026)
  ├── Matches (start_time, status, venue, teams)
  ├── Global League  ← all users auto-joined
  │     └── Master Campaign (global questions for every match)
  └── Private League(s)  ← invite-only via join_code
        └── League Campaign(s) (extend or supplement global questions)
```

### Core Concepts

| Concept | Description |
|---|---|
| **Tournament** | Top-level entity. Matches and global campaigns are scoped to it. |
| **Global League** | Auto-created per tournament. Every user is a member. Powers the global leaderboard. |
| **Private League** | Friend groups compete here. Members see league-specific campaigns and leaderboard. |
| **Master Campaign** | `is_master=True` campaign. Single source of truth for correct answers and scoring. |
| **League Campaign** | Additional questions scoped to a specific league. Scoring applies only to that league's leaderboard. |
| **CampaignMatchResult** | Stores the correct answers for a Campaign + Match pair. Drives the scoring engine. |
| **LeaderboardCache** | Pre-aggregated scores. `league_id=None` = global; specific `league_id` = league total. |

---

## Database Models

### Key Tables

```
Tournament          id, name, status, starts_at, ends_at, master_campaign_id
League              id, name, tournament_id, join_code, is_global
LeagueAdminMapping  user_id, league_id
LeagueUserMapping   user_id, league_id, joined_at
Match               id, team1, team2, venue, start_time, status, tournament_id
Campaign            id, name, tournament_id, league_id (nullable), is_master
CampaignQuestion    id, campaign_id, key, question_text, answer_type, options, scoring_rules, order
CampaignResponse    id, user_id, campaign_id, match_id, answers (JSON)
CampaignMatchResult id, campaign_id, match_id, correct_answers (JSON)
LeaderboardCache    user_id, tournament_id, league_id (nullable), total_points
LeaderboardEntry    user_id, match_id, points, points_breakdown (JSON), league_id (nullable)
MatchStats          match_id, stats_json (Gemini-generated head-to-head, form, players to watch)
```

---

## Implementation Status

### ✅ Phase 1: Tournament & Global League Migration
- `Tournament`, `League`, `LeagueAdminMapping`, `LeagueUserMapping` models created.
- All existing matches migrated to "IPL 2026" tournament.
- All existing users auto-joined to the Global League.
- Master Match Campaign created with questions matching the legacy hardcoded fields.

### ✅ Phase 2: League & Admin Foundation
- `league_router.py`: Create, join, kick, list leagues.
- `LeagueAdmin.tsx`: Member management and campaign grading for league admins.
- `Leagues.tsx`: User-facing leagues list with metadata and join flow.
- `is_league_admin` flag on User model; league admin permissions enforced via `permissions.py`.

### ✅ Phase 3: Campaign Extensions & Dynamic Scoring
- `CampaignMatchResult` table stores per-campaign correct answers.
- Prediction form merges Master + League-specific questions dynamically.
- Scoring engine is fully polymorphic — no hardcoded question IDs.
- Backend substitutes `{{Team1}}` / `{{Team2}}` placeholders at question-fetch time.

### ✅ Phase 4: Leaderboard & Caching
- `LeaderboardCache` table with `league_id=None` (global) and per-league entries.
- Scoring engine upserts cache on every match completion or campaign grading event.
- `recalculate_leaderboards.py` backfill script for historical data.

### ✅ Phase 5: User & League Admin UX
- `Leaderboard.tsx` renders one `LeaderboardSection` per league the user belongs to.
- `MatchPage.tsx` community reveal groups predictions by league — users only see predictions from their shared leagues (or a Global fallback).
- Admin panel scoped: League admins only see their own league's campaigns.

### ✅ Phase 6: Dynamic Frontend Rendering
- `renderPredictionCard` in `MatchPage.tsx` is fully dynamic — iterates over `pred.answers` keys, no hardcoded question IDs.
- Match official results section also dynamic — renders all `match.results` keys.
- `getTeamColor` / `getTeamShortName` in `teamColors.ts` accept `any` type (safe against numeric or undefined values).

### ✅ Phase 7: Match Column Rename
- `toss_time` renamed to `start_time` in the DB and all Python/TypeScript code.
- API returns `tossTime` (ISO string, used by frontend for lock/countdown) AND `start_time` (raw value).
- Frontend uses `tossTime` consistently for the 30-minute lock calculation.

### ✅ Phase 8: Bulk Match Import
- Admin panel includes a CSV import tool for bulk match creation under the Tournament section.
- Accepts sequential IDs (1, 2, 3) and auto-formats to `tournament-year-number`.
- Required CSV columns: `id, team1, team2, venue, toss_time`

---

## Scoring Logic

### Global (Master Campaign)

| Rule | Detail |
|---|---|
| Match Winner | +10 correct, −5 incorrect |
| Player of the Match | +25 correct |
| Powerplay (exact) | +15 |
| Powerplay (±5 range) | +5 |
| Sixes / Fours team | +5 correct |
| Non-participation | −5 from Match 12 onwards |
| AI Assassin penalty | Starts from Match 25 |

### Powerup (2× Booster)
- Tracked globally per user (`User.base_powerups`).
- Multiplies: Winner, POM, Powerplay
- Does **not** multiply: Sixes, Fours

### Late Entrants
- Inherit full global powerup inventory.
- Protected from retroactive non-participation penalties (matches before `user.created_at`).
- Can receive a `User.base_points` catch-up handicap applied globally and in private leagues.

### League Campaign
- Points computed per-league using `CampaignMatchResult` for that league's campaign.
- Aggregated into `LeaderboardCache` with the specific `league_id`.

---

## Community Reveal Logic

1. `GET /matches/{id}/predictions/all` returns HTTP 403 until `start_time - 30 minutes`.
2. After lock, the endpoint:
   - Identifies all leagues the requesting user shares with other predictors.
   - Groups predictions into league sections (e.g., "League 1 | Community Reveal", "IPL Global").
   - Each section includes `league.id`, `league.name`, and the list of predictions.
3. Frontend renders one reveal block per section. Desktop view splits into Team 1 / Team 2 supporter columns.
4. Answer cards render all `pred.answers` keys dynamically — question label pulled from `questionMap` lookup.

---

## API Surface (Current)

```
# Auth
GET  /auth/google
GET  /auth/callback
GET  /auth/me
POST /auth/logout

# Matches
GET  /matches                              list all (filtered by tournament_id)
GET  /matches/{id}                         match detail + questions + my prediction
POST /matches/{id}/predictions             submit (locked 30 min before start_time)
PUT  /matches/{id}/predictions             update (same lock)
GET  /matches/{id}/predictions/mine        current user's prediction
GET  /matches/{id}/predictions/all         community reveal (403 if not locked yet)
POST /matches/{id}/autopredict             AI auto-predict for current user

# Tournaments
GET  /tournaments                          list tournaments
POST /tournaments                          create (admin)
GET  /tournaments/{id}/matches             matches for tournament
POST /tournaments/{id}/bulk-import-matches CSV bulk import (admin)

# Leagues
GET  /leagues/my                           user's leagues
POST /leagues                              create league (admin)
POST /leagues/join                         join via join_code
GET  /leagues/{id}                         league detail
GET  /leagues/{id}/members                 members list
DELETE /leagues/{id}/members/{uid}         kick member

# Campaigns
GET  /campaigns                            list campaigns for user
GET  /campaigns/{id}                       campaign detail + questions
POST /campaigns/{id}/respond               submit/update response
GET  /campaigns/{id}/matches/{mid}/results correct answers

# Leaderboard
GET  /leaderboard                          global or league standings (league_id param)
GET  /leaderboard/analysis                 performance analytics + elite splits
GET  /leaderboard/hall-of-fame             badges (Sixster, Fourster, etc.)

# Admin
GET  /admin/users                          all users
PUT  /admin/users/{id}                     update user (is_admin, is_guest, etc.)
GET  /admin/allowlist                      allowlisted emails
POST /admin/allowlist                      add emails
DELETE /admin/allowlist/{email}            remove email
PUT  /admin/matches/{id}/results           set correct answers + trigger scoring
POST /admin/campaigns/{id}/grade/{mid}     grade campaign for a match
POST /admin/trigger-ai-predictions/{id}    trigger AI competitor for a match

# External / Webhooks
PUT  /external/match-results               n8n webhook for Telegram-parsed results
```

---

*Last Updated: 2026-04-30*
