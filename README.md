# IPL Fantasy 2026 — Premium Prediction Platform

A sophisticated, private IPL Fantasy Cricket prediction platform designed for competitive friend groups. This project features a robust FastAPI backend and a high-performance React frontend, integrating multi-league architecture, dynamic campaigns, AI competitors, and automated match result processing.

---

## 🌟 Key Features

### 🏆 Multi-League & Campaign System
- **Dynamic Campaigns**: Create "Master" or "Match-specific" campaigns with ease.
- **Rich Question Types**: Support for multiple choice, toggle, dropdown, free text, and numeric inputs.
- **Advanced Scoring**: Tiers, selection caps, and penalties for non-participation.
- **Real-time Leaderboards**: Global and per-match/league rankings with distinct styling for top performers.

### 🎮 Gamification & AI
- **AI Competitor**: An autonomous competitor that makes heuristic-based predictions using historical data.
- **Powerups**: Strategic powerup system (e.g., scoring multipliers) to gain an edge in the leaderboard.
- **Match Center**: A unified dashboard for upcoming matches, live scores, and quick prediction access.

### 📊 Performance Analytics
- **Visual Insights**: Interactive stacked bar charts (Match vs. Base points) to visualize performance over time.
- **Trending Stats**: Track your momentum and accuracy percentages.
- **Community Reveal**: "What everyone predicted" table appears once predictions lock, highlighting "MY PICK" and correct/incorrect answers.

### 🤖 Automation & Integration
- **n8n Webhook Integration**: Automated match result ingestion and scoring triggers via external tools.
- **Telegram Admin**: Secure admin validation and status updates via Telegram handles.
- **Automated Results**: Background scrapers for ESPNcricinfo and CricAPI to keep data fresh.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12 · FastAPI (Async) |
| **Database** | PostgreSQL · SQLAlchemy 2.0 (Async) · Alembic |
| **Frontend** | React 18 · Vite · TypeScript |
| **Styling** | Tailwind CSS v4 · Framer Motion (Animations) |
| **State Management** | Zustand (Auth/UI) · TanStack Query v5 (Data) |
| **Auth** | Google OAuth 2.0 · JWT |
| **Automation** | n8n · APScheduler |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL (or Neon.tech)
- Google Cloud Project (for OAuth credentials)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r ../requirements.txt
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 4. Database Setup & Seeding
Initialize the database and seed initial data:
```bash
# Run migrations
python migrate_db.py

# Seed initial admin
python seed_admin.py your-email@gmail.com

# Seed matches and AI competitor
python seed_matches.py
python seed_ai.py
```

### 5. Running the Application
Use the provided shell scripts for convenience:
```bash
./start_all.sh  # Starts both Backend and Frontend
```

---

## 📁 Project Structure

```text
├── backend/            # FastAPI application
│   ├── router/         # API endpoints (Auth, Admin, Campaigns, etc.)
│   ├── models.py       # SQLAlchemy database models
│   ├── scoring.py      # Core scoring logic
│   └── utils/          # Shared utilities (Cache, Scrapers)
├── frontend/           # React + Vite application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Top-level page views
│   │   ├── store/      # Zustand state management
│   │   └── types/      # TypeScript interfaces
├── migrations/         # Alembic migration files
└── *seed_*.py          # Initial data seeding scripts
```

---

## 🔧 Maintenance Scripts

- `migrate_db.py`: Synchronizes the database schema with the models.
- `reset_and_seed.py`: Full database reset (WIPES DATA) and re-seeds all data.
- `seed_ai.py`: Initializes the AI competitor with base points.
- `seed_matches.py`: Fetches and populates the match schedule.

---

## 🔒 Security & Admin

- **Allowlist Gate**: Only pre-approved emails can log in.
- **Telegram Admin**: Manage authorization status for remote automation tools.
- **Prediction Locking**: Strict server-side enforcement 30 minutes before the toss.

---

## 📈 Roadmap & Upcoming Features
- [ ] Group-based Private Leagues
- [ ] Push Notifications for Match Locks
- [ ] Detailed Head-to-Head Statistics
- [ ] Dynamic Powerup Rewards

---

Developed with ❤️ for the IPL 2026 season.