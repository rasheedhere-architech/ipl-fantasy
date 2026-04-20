# Implementation Plan: League Management System

This plan outlines the steps to implement a hierarchical league management system where Super Admins can manage leagues/league-admins, and League Admins can manage league-specific resources (matches, campaigns, groups).

## 1. Database Schema Enhancements (SQLAlchemy)

### New Models
- `League`: Core entity with `id`, `name`, `join_code` (unique invite string), and `settings` (JSON for scoring overrides).
- `LeagueAdminMapping`: M2M relationship allowing a user to manage multiple leagues.
- `LeagueUserMapping`: M2M relationship for user participation. Stores `joined_at` to handle mid-season entry logic.
- `UserGroup`: Entities for grouping users within a league.
- `UserGroupMember`: M2M relationship for users in groups.
- `LeagueMatchMapping`: Association of specific matches to a league.
- `LeagueCampaignMapping`: Association of specific campaigns to a league.

### Relationships
- `League` ↔ `Match`: Many-to-Many.
- `League` ↔ `Campaign`: Many-to-Many.
- `League` ↔ `UserGroup`: One-to-Many.
- `User` ↔ `League` (as Admin): Many-to-Many.
- `User` ↔ `League` (as Participant): Many-to-Many.

## 2. API Design (FastAPI)

### Global Admin Routes (`/api/admin/leagues`)
- `POST /`: Create a new league.
- `GET /`: List all leagues.
- `POST /{league_id}/admins`: Assign league admins (User IDs).
- `DELETE /{league_id}/admins/{user_id}`: Revoke league admin status.

### League Admin Routes (`/api/leagues/{league_id}/manage`)
- `POST /groups`: Create a user group for the league.
- `POST /groups/{group_id}/users`: Add users to a group (bulk email upload or selection).
- `POST /matches`: Link existing matches to the league.
- `POST /campaigns`: Create or link campaigns to the league.
- `GET /members`: View participants in the league.

### User Routes (`/api/leagues`)
- `GET /me`: List leagues the user is part of.
- `GET /{league_id}/leaderboard`: Fetch league-specific rankings.
- `GET /{id}`: League details (matches, active campaigns).

## 3. Authorization & Permissions
- Implement a `get_current_league_admin` dependency that verifies if the authenticated user is listed in `LeagueAdminMapping` for the requested `{league_id}`.
- Global `is_admin` users retain "Super Admin" privileges over all leagues.

## 4. Leaderboard Logic
- **Current State**: `leaderboard_entries` table tracks points per match per user.
- **Proposal**: 
    - Create a view or service that filters `leaderboard_entries` and `campaign_responses` by the Match IDs and Campaign IDs associated with a specific `league_id`.
    - `League Points = Sum(Match Points in League) + Sum(Campaign Points in League)`.

## 5. Frontend Architecture (React/Vite)

### New Pages
- `AdminLeagues`: For Super Admins to create leagues and assign admins.
- `LeagueAdminDashboard`: A workspace for League Admins to manage their specific league (matches, campaigns, groups).
- `MyLeagues`: A landing page for users to see their active leagues.
- `GlobalLeaderboard`: The "Main" leaderboard showing every user's performance on Master Match Campaigns.
- `LeagueMatchCenter`: Similar to the current MatchCenter but filtered to league-specific matches.

### Component Updates
- `Navbar`: Add a "Leagues" dropdown or link.
- `Leaderboard`: Update to accept a `leagueId` prop to display filtered rankings.

## 6. Advanced Scenarios & Edge Cases

- **Prediction Multiplexing**:
    - Users make one prediction per match globally.
    - Scoring service must iterate through all active leagues the user is in to update their specific league rank.
- **Mid-Season Joining**:
    - **Policy**: Users start with 0 points from the date of joining.
    - **Implementation**: Filter match scoring events where `match.toss_time > league_user_mapping.joined_at`.
- **Private Access**:
    - Leagues can be joined via a 6-character `join_code` or via automatic group associations (e.g., "Company A" group).
- **Admin Transfers**:
    - Support for "Owner" role to prevent league admins from accidentally locking themselves out.
- **Master Match Campaigns**:
    - Every Match has exactly one "Master Match Campaign" (flagged with `is_master=True`).
    - **Inheritance**: All leagues automatically include responses from these Master Campaigns. 
    - **Global Leaderboard**: A special, auto-managed league (ID: `global`) that tracks total points across all users, exclusively from Master Match Campaigns.
    - **Scoring Flow**: `Score Master Campaign` -> `Update Global Leaderboard` -> `Iterate & Update all User's Joined Leagues`.

## 7. Scalability Refinements
- **Leaderboard Scalability (Redis ZSETs)**:
    - Avoid `SUM()` queries on millions of rows.
    - Use Redis Sorted Sets: `ZINCRBY league:{id}:rank {points} {user_id}`.
    - Retrieval: `ZREVRANGE league:{id}:rank 0 99 WITHSCORES` for Top 100 in $O(\log N)$.
- **Indexing Strategy**:
    - Composite index on `LeagueUserMapping(user_id, league_id)`.
    - Index on `Prediction(match_id, user_id)` for rapid scoring lookups.
- **Caching User Context**:
    - Cache `user_leagues_list` in Redis/Session to avoid re-querying membership on every page load.
- **Bulk Operations**:
    - Async background workers (Celery/Arq) for large-scale leaderboard recalculations after major matches.

## 8. Migration Steps
1. Create and apply Alembic migrations for new tables.
2. Update `backend/models.py` with SQLAlchemy relationships.
3. Implement `league_router.py` and register in `main.py`.
4. Create frontend pages and API integration hooks.
5. Seed default "Global League" to migrate existing users/matches.
