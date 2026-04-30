# Implementation Plan: Tournament & League Management System

This plan outlines the steps to implement a hierarchical system based on **Tournaments** (e.g., IPL 2026, T20 World Cup 2027) which encapsulate global matches, global campaigns, and user-created private leagues.

## 1. Core Architecture & Concepts

- **Tournaments**: The overarching entity. Matches and Global Campaigns are tied to a specific Tournament. Tournaments have start and end dates.
- **Global Matches & Predictions**: Users make **exactly ONE prediction** per match. This prediction is global. A user cannot make different submissions for the same match across different leagues.
- **Leagues**: Users create or join private Leagues within a specific Tournament to compete against a smaller subset of friends or colleagues. A League "ends" when its parent Tournament ends.
- **Leaderboards**: 
  - The **Global Leaderboard** ranks all users based on their global match and global campaign points for a given Tournament. A user has exactly 1 entry here.
  - A **League Leaderboard** ranks only the members of that league. Their points are based on their global predictions PLUS any private campaigns specific to that league. A user has 1 entry here.
- **Legacy Fields**: `User` model `base_points` and `base_powerups` are **legacy fields** used only for the Global League migration. New users default to 0.

## 2. Database Schema Enhancements (SQLAlchemy)

### New Models
- `Tournament`: `id`, `name` (e.g., "IPL 2026"), `status` (upcoming, active, completed), `starts_at`, `ends_at`.
- `League`: `id`, `name`, `tournament_id`, `join_code` (unique invite string), `starting_powerups` (int).
- `LeagueAdminMapping`: M2M relationship allowing users to manage a league.
- `LeagueUserMapping`: M2M relationship for user participation. Stores `joined_at`, `remaining_powerups`.
- `LeagueCampaignMapping`: Association of specific private campaigns to a league.
- `CampaignMatchResult`: Stores the "Ground Truth" (correct answers) for a specific Campaign + Match pair.
- `LeaderboardCache`: Caches aggregated scores to prevent slow dynamic SUM() queries. Fields: `user_id`, `tournament_id` (nullable), `league_id` (nullable), `total_points`.



### Modifications to Existing Models
- `Match`: Add `tournament_id` (ForeignKey).
- `Campaign`: Add `tournament_id` (ForeignKey) for global campaigns. Add `league_id` (ForeignKey, nullable) for private campaigns created within a league.

### Relationships
- `Tournament` ↔ `Match`: One-to-Many.
- `Tournament` ↔ `League`: One-to-Many.
- `Tournament` ↔ `Campaign`: One-to-Many.
- `User` ↔ `League` (as Admin/Participant): Many-to-Many.

## 3. API Design (FastAPI)

### Global Admin Routes (`/api/admin`)
- **Leagues**: `POST /leagues` (Create new league), `POST /leagues/{id}/admins` (Assign league admins).
- **Tournaments**: `POST /tournaments` (Create tournaments), `POST /tournaments/{id}/matches` (Add matches).
- **Grading**: `POST /campaigns/{id}/matches/{mid}/grade` (Grade global match campaigns).

### Tournament Routes (`/api/tournaments`)
- `GET /`: List all tournaments (active, past).
- `GET /{tournament_id}/matches`: List matches for a tournament.
- `GET /{tournament_id}/leaderboard`: Global leaderboard for the tournament.

### League Routes (`/api/tournaments/{tournament_id}/leagues`)
- `POST /`: Create a new league for this tournament.
- `GET /`: List public leagues or leagues the user is in.
- `POST /join`: Join a league using a `join_code`.

### League Admin Routes (`/api/leagues/{league_id}/manage`)
- `POST /campaigns`: Create a private campaign specifically for this league.
- `POST /campaigns/{campaign_id}/matches/{match_id}/grade`: Post correct answers for a custom campaign for a specific match.
- `GET /members`: View participants.
- `DELETE /members/{user_id}`: Kick a user from the league.
- `POST /invite`: Generate/reset join code.

### User Context
- `GET /api/users/me/leagues`: List all active leagues the user is part of, grouped by Tournament.

## 4. Leaderboard & Scoring Logic

1. **Global Scoring Flow**: 
   - A Match is completed. Points are calculated and saved in `leaderboard_entries` for every user who predicted.
   - These points automatically apply to the Tournament's Global Leaderboard.
2. **League Scoring Flow**:
   - **Time-Bound Scoring**: A user's League Points only aggregate points from matches and campaigns that locked *after* their `LeagueUserMapping.joined_at` timestamp.
   - **Penalty Overrides**: A global match campaign might have a -5 point non-participation penalty. A League Campaign extending it can override this value (e.g., set to 0). The scoring engine uses the overriding penalty exclusively for that league's cached score.
    - **Background Caching [COMPLETED]**: When a match is marked completed, or a campaign is scored, the system computes these totals and upserts them directly into the `LeaderboardCache` table. The `LeaderboardCache` stores entries for both `league_id=None` (Global) and specific `league_id`.

## 5. Frontend Architecture (React/Vite)

### Navigation & Context
- Introduce a **Tournament Selector** (e.g., dropdown in navbar) to switch context between "IPL 2026" and "T20 World Cup 2027".
- The active Tournament dictates which matches, campaigns, and leaderboards are displayed.

### New Pages
- `TournamentDashboard`: Landing page showing active matches and user's active leagues for the selected tournament.
- `MyLeagues`: List of the user's leagues with quick stats.
- `LeagueDetails`: Shows the league's private leaderboard, members, and any private campaigns.

### Component Updates
- `Leaderboard`: Update to accept `tournamentId` and optionally `leagueId` props to fetch the correct data scope.

## 6. Campaign Extensions & Inheritances

A powerful feature of leagues is the ability to **extend** Global Match Campaigns with League-Specific questions.

### The Scenario
- A Global Match Campaign for Match X has questions 1, 2, 3, 4, 5.
- League 1 wants to add two custom questions (6, 7) for this match.
- League 2 wants to add different custom questions (8, 9) for this match.

### Database & API Design
- **Campaign Model Update**: Add a `parent_campaign_id` (ForeignKey, nullable). If a league campaign extends a global one, it links to it here.
- **Fetching the Form**: When the user requests the prediction form for Match X within the context of League 1 (e.g., `GET /api/leagues/{league_id}/matches/{match_id}/campaign`), the API returns:
  1. The Global Campaign questions (Q1-Q5).
  2. The League 1 Campaign extension questions (Q6-Q7).
  3. The user's existing responses to the Global Campaign.
  4. The user's existing responses to the League 1 Campaign.

### User Experience (UX) Flow
1. **Initial Submission (League 1)**: User1 views Match X in League 1. They see questions 1-7. They fill them out and hit submit.
   - *Backend Action*: The system saves the answers for Q1-Q5 to the **Global Campaign Response** table, and Q6-Q7 to the **League 1 Campaign Response** table.
2. **Subsequent Submission (League 2)**: Later, User1 goes to League 2 and views Match X. They see questions 1-5, plus 8-9. 
   - *Auto-Population*: Because they already submitted Q1-Q5 globally, those fields are **auto-populated** with their previous answers.
   - *Updating*: If they change the answer to Q1 while in League 2, it updates the *single global source of truth*. That means their answer for Q1 is now updated for the Global Leaderboard, League 1, and League 2 simultaneously.
   - They fill out Q8-Q9 and submit. The global response is updated, and the new answers are saved to the League 2 Campaign Response table.

### Per-Match Grading Responsibility
- **Global Admin**: Responsible for posting the ground truth for Q1-Q5 after the match ends. This triggers a score update for **all users** across the Global Leaderboard and all Leagues.
- **League Admin**: Responsible for posting the ground truth for their specific questions (e.g., Q6-Q7 for League 1) for each match. This triggers a score update **only for that league's** members and leaderboard cache.

## 7. Edge Cases Handled

- **Multiple Leagues, Different Global Predictions?**: Prevented by design. Because global questions are single-source-of-truth, changing a global question in *any* league updates it everywhere.
- **End of Season**: The `Tournament` model handles this. Once `status = completed`, the Tournament and all its child Leagues are archived and become read-only historical records.
- **Global Campaigns**: Campaigns created by Super Admins tied to the `Tournament` apply to everyone.
- **Private Campaigns**: Campaigns created by League Admins tied to a `League` apply ONLY to that league's members and leaderboard.

## 8. Implementation & Migration Steps

1.  **Phase 1: Tournament & Global League Migration [COMPLETED]**
    *   **Schema**: Create `Tournament` and `League` models. Add `tournament_id` to `Match`/`Campaign`.
    *   **Data Migration**:
        *   Create a "Default IPL 2026" `Tournament`.
        *   Create a **"Global League"** tied to this tournament.
        *   Create a **"Master Match Campaign"** with questions representing the current hardcoded match predictions.
        *   Associate all existing matches with the new Tournament.
        *   **User Migration**:
            *   Automatically join all existing users to the "Global League".
            *   **Legacy Data Porting**: Base points and base powerups are ONLY for existing data. 
            *   **Reset Global Trackers**: Set `User.points = 0` and `User.base_powerups = 0` post-migration.
2.  **Phase 2: League & Admin Foundation [IN PROGRESS]**
    *   **Schema**: Implement `LeagueAdminMapping` and `LeagueUserMapping`.
    *   **Backend**: Develop `league_router.py` for creation, joining, and kicking.
    *   **Frontend**: Add a "Leagues" tab and ensure "Global League" is prominently displayed.
3.  **Phase 3: Campaign Extensions & Dynamic Results [COMPLETED]**
    *   **Schema**: Add `parent_campaign_id` to `Campaign`. Create `CampaignMatchResult` table.
    *   **Logic**: Update prediction logic to merge Master questions with League-specific questions.
    *   **Polymorphic Engine**: Migration from hardcoded Match fields to dynamic Question/Result mapping.
4. - [x] Phase 4: Leaderboard & Caching [COMPLETED]
    *   **Schema**: Implement `LeaderboardCache` and added `league_id` to `LeaderboardEntry`.
    *   **Logic**: Aggregation logic handles `league_id=None` for global standings and combined scores for leagues.
    *   **Backfill**: Scripted recalculation of cache for all users in the tournament.
5. - [x] Phase 5: User & League Admin UX [COMPLETED]
    *   **Tournament Context Switcher**: Integrated into `Leaderboard.tsx` using the `selectedLeagueId` state and `/my-leagues` metadata.
    *   **League List**: `/leagues` shows all joined leagues with metadata.
    *   **Admin Dashboard**: `LeagueAdmin.tsx` implements member management and campaign grading.
    *   **Data Isolation**: `list_campaigns` filtered by user's league membership.
