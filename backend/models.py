from datetime import datetime, UTC
import enum
from sqlalchemy import String, Integer, DateTime, Boolean, JSON, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Any, Optional, List
from .database import Base

class MatchStatus(str, enum.Enum):
    upcoming = "upcoming"
    live = "live"
    completed = "completed"
    cancelled = "cancelled"

class TournamentStatus(str, enum.Enum):
    upcoming = "upcoming"
    active = "active"
    completed = "completed"

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    google_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    avatar_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    is_guest: Mapped[bool] = mapped_column(Boolean, server_default='false', default=False)
    is_league_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_telegram_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    telegram_username: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # League Relationships
    joined_leagues: Mapped[list["League"]] = relationship("League", secondary="league_user_mappings", back_populates="participants")
    managed_leagues: Mapped[list["League"]] = relationship("League", secondary="league_admin_mappings", back_populates="admins")

class AllowlistedEmail(Base):
    __tablename__ = "allowlisted_emails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    is_guest: Mapped[bool] = mapped_column(Boolean, server_default='false', default=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class UserDevice(Base):
    __tablename__ = "user_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    fcm_token: Mapped[str] = mapped_column(String, unique=True, index=True)
    device_type: Mapped[str] = mapped_column(String)  # "ios", "android", "web"
    last_active: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user: Mapped["User"] = relationship("User", backref="devices")

class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    status: Mapped[TournamentStatus] = mapped_column(SAEnum(TournamentStatus), default=TournamentStatus.upcoming)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Direct FK to the master campaign for this tournament (avoids querying campaigns table)
    master_campaign_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("campaigns.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    leagues: Mapped[list["League"]] = relationship("League", back_populates="tournament")
    matches: Mapped[list["Match"]] = relationship("Match", back_populates="tournament")

class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    external_id: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True, nullable=True)
    team1: Mapped[str] = mapped_column(String)
    team2: Mapped[str] = mapped_column(String)
    venue: Mapped[str] = mapped_column(String)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[MatchStatus] = mapped_column(SAEnum(MatchStatus))
    tournament_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("tournaments.id"), nullable=True)

    raw_result_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    reported_by: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    report_method: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # "telegram", "manual", "api", "agent"

    reporter: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reported_by])
    tournament: Mapped[Optional["Tournament"]] = relationship("Tournament", back_populates="matches")
    results: Mapped[list["CampaignMatchResult"]] = relationship("CampaignMatchResult", back_populates="match", cascade="all, delete-orphan")


# ── Campaign System ──────────────────────────────────────────────────────────

class CampaignStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    closed = "closed"

class CampaignType(str, enum.Enum):
    match = "match"
    general = "general"

class QuestionType(str, enum.Enum):
    toggle = "toggle"
    multiple_choice = "multiple_choice"
    dropdown = "dropdown"
    free_text = "free_text"
    free_number = "free_number"

class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    type: Mapped[CampaignType] = mapped_column(SAEnum(CampaignType), default=CampaignType.general)
    is_master: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[CampaignStatus] = mapped_column(SAEnum(CampaignStatus), default=CampaignStatus.draft)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    non_participation_penalty: Mapped[int] = mapped_column(Integer, default=0)
    tournament_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("tournaments.id"), nullable=True)
    league_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("leagues.id"), nullable=True)
    match_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("matches.id"), nullable=True)
    parent_campaign_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("campaigns.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    questions: Mapped[list["CampaignQuestion"]] = relationship(
        "CampaignQuestion", back_populates="campaign",
        cascade="all, delete-orphan", order_by="CampaignQuestion.order_index"
    )
    responses: Mapped[list["CampaignResponse"]] = relationship(
        "CampaignResponse", back_populates="campaign", cascade="all, delete-orphan"
    )

class CampaignQuestion(Base):
    __tablename__ = "campaign_questions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    campaign_id: Mapped[str] = mapped_column(String, ForeignKey("campaigns.id"))
    # Stable slug key — used as the key in CampaignResponse.answers and CampaignMatchResult.correct_answers
    # e.g. "match_winner", "pp_team1", "potm"
    key: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    question_text: Mapped[str] = mapped_column(String)
    question_type: Mapped[QuestionType] = mapped_column(SAEnum(QuestionType))
    # For toggle/multiple_choice/dropdown: list of option strings
    options: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Scoring: {"type": "exact_match"|"difference"|"multi_choice", "points": N, "wrong_points": N, "thresholds": [...]}
    scoring_rules: Mapped[dict] = mapped_column(JSON)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_powerup: Mapped[bool] = mapped_column(Boolean, default=True, server_default='true')

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="questions")

class CampaignResponse(Base):
    """One row per (user, campaign, match). Stores all answers as a flat JSON dict."""
    __tablename__ = "campaign_responses"
    __table_args__ = (
        UniqueConstraint("campaign_id", "user_id", "match_id", name="uq_campaign_response"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    campaign_id: Mapped[str] = mapped_column(String, ForeignKey("campaigns.id"), index=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    match_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("matches.id"), nullable=True, index=True)

    # All question answers stored as {question_id: answer_value}
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    use_powerup: Mapped[bool] = mapped_column(Boolean, default=False)
    is_auto_predicted: Mapped[bool] = mapped_column(Boolean, default=False)

    # Populated after scoring
    total_points: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    points_breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="responses")


# ── League System ────────────────────────────────────────────────────────────

class LeagueAdminMapping(Base):
    __tablename__ = "league_admin_mappings"
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)

class LeagueUserMapping(Base):
    __tablename__ = "league_user_mappings"
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class LeagueCampaignMapping(Base):
    __tablename__ = "league_campaign_mappings"
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(String, ForeignKey("campaigns.id"), primary_key=True)

class League(Base):
    __tablename__ = "leagues"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    tournament_id: Mapped[str] = mapped_column(String, ForeignKey("tournaments.id"))
    join_code: Mapped[str] = mapped_column(String, unique=True, index=True)
    is_global: Mapped[bool] = mapped_column(Boolean, default=False)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="leagues")
    participants: Mapped[list["User"]] = relationship("User", secondary="league_user_mappings", back_populates="joined_leagues")
    admins: Mapped[list["User"]] = relationship("User", secondary="league_admin_mappings", back_populates="managed_leagues")
    mapped_campaigns: Mapped[list["Campaign"]] = relationship("Campaign", secondary="league_campaign_mappings")


# ── Scoring & Leaderboard ────────────────────────────────────────────────────

class CampaignMatchResult(Base):
    """Ground truth for a campaign + match pair. Drives the scoring engine."""
    __tablename__ = "campaign_match_results"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    campaign_id: Mapped[str] = mapped_column(String, ForeignKey("campaigns.id"))
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"))
    # {question_id: correct_answer_value}
    correct_answers: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    match: Mapped["Match"] = relationship("Match", back_populates="results")
    campaign: Mapped["Campaign"] = relationship("Campaign")

class LeaderboardEntry(Base):
    """Per-(user, match, league) fact table for point history and progression charts."""
    __tablename__ = "leaderboard_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "match_id", "league_id", name="uq_leaderboard_entry"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"), index=True)
    # None = global league entry; set to league id for league-specific entries
    league_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("leagues.id"), nullable=True, index=True)
    points: Mapped[int] = mapped_column(Integer)
    points_breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class LeaderboardCache(Base):
    """Pre-aggregated total points per (user, tournament, league) for fast leaderboard queries."""
    __tablename__ = "leaderboard_cache"
    __table_args__ = (
        UniqueConstraint("user_id", "tournament_id", "league_id", name="uq_leaderboard_cache"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    tournament_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("tournaments.id"), nullable=True)
    league_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("leagues.id"), nullable=True)
    total_points: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class MatchStats(Base):
    """AI-generated pre-match stats (Gemini Search grounding)."""
    __tablename__ = "match_stats"

    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"), primary_key=True)
    stats_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

# ── Foundational Upgrades ──────────────────────────────────────────────────

class TournamentUserMapping(Base):
    """Stores per-tournament stats (powerups, handicaps) for a user."""
    __tablename__ = "tournament_user_mappings"
    tournament_id: Mapped[str] = mapped_column(String, ForeignKey("tournaments.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    
    base_points: Mapped[int] = mapped_column(Integer, default=0)
    base_powerups: Mapped[int] = mapped_column(Integer, default=10)
    powerups_used: Mapped[int] = mapped_column(Integer, default=0)
    notification_preferences: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "match_results": True,
        "new_campaigns": True,
        "league_activity": True,
        "priority_alerts": True
    })
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class SystemEventType(str, enum.Enum):
    login = "login"
    league_joined = "league_joined"
    prediction_submitted = "prediction_submitted"
    match_scored = "match_scored"
    campaign_created = "campaign_created"
    admin_action = "admin_action"

class SystemEvent(Base):
    """Unified activity stream for the platform (The 'Pulse')."""
    __tablename__ = "system_events"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    league_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("leagues.id"), nullable=True)
    match_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("matches.id"), nullable=True)
    campaign_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("campaigns.id"), nullable=True)
    
    # Notification & Delivery
    target_user_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True) # If null, broadcast or league-wide
    priority: Mapped[str] = mapped_column(String, default="low") # low, medium, high, critical
    
    message: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

