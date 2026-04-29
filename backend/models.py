from datetime import datetime, UTC
import enum
from sqlalchemy import String, Integer, DateTime, Boolean, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship, Mapped, mapped_column
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
    avatar_url: Mapped[str] = mapped_column(String, nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    is_guest: Mapped[bool] = mapped_column(Boolean, server_default='false', default=False)
    is_telegram_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    telegram_username: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=True)
    base_points: Mapped[int] = mapped_column(Integer, default=0)
    base_powerups: Mapped[int] = mapped_column(Integer, default=10)
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

class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=True)
    team1: Mapped[str] = mapped_column(String)
    team2: Mapped[str] = mapped_column(String)
    venue: Mapped[str] = mapped_column(String)
    toss_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[MatchStatus] = mapped_column(SAEnum(MatchStatus))
    tournament_id: Mapped[str] = mapped_column(String, ForeignKey("tournaments.id"), nullable=True) # Temporarily nullable for migration
    
    # Ground Truth Results (for scoring)
    winner: Mapped[str] = mapped_column(String, nullable=True)
    team1_powerplay_score: Mapped[int] = mapped_column(Integer, nullable=True)
    team2_powerplay_score: Mapped[int] = mapped_column(Integer, nullable=True)
    player_of_the_match: Mapped[str] = mapped_column(String, nullable=True)
    more_sixes_team: Mapped[str] = mapped_column(String, nullable=True)
    more_fours_team: Mapped[str] = mapped_column(String, nullable=True)
    
    raw_result_json: Mapped[dict] = mapped_column(JSON, nullable=True)
    reported_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    report_method: Mapped[str] = mapped_column(String, nullable=True) # "telegram", "manual", "api", "agent"
    
    reporter: Mapped["User"] = relationship("User", foreign_keys=[reported_by])
    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="matches")

class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"))
    
    # Flattened Prediction Fields
    match_winner: Mapped[str] = mapped_column(String, nullable=True)
    team1_powerplay: Mapped[int] = mapped_column(Integer, nullable=True)
    team2_powerplay: Mapped[int] = mapped_column(Integer, nullable=True)
    player_of_the_match: Mapped[str] = mapped_column(String, nullable=True)
    more_sixes_team: Mapped[str] = mapped_column(String, nullable=True)
    more_fours_team: Mapped[str] = mapped_column(String, nullable=True)
    use_powerup: Mapped[str] = mapped_column(String, default="No") # "Yes" or "No"
    is_auto_predicted: Mapped[bool] = mapped_column(Boolean, default=False)
    
    points_awarded: Mapped[int] = mapped_column(Integer, nullable=True)
    points_breakdown: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class ScoringRule(Base):
    __tablename__ = "scoring_rules"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    config_json: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

class LeaderboardEntry(Base):
    __tablename__ = "leaderboard_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"))
    points: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


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
    description: Mapped[str] = mapped_column(String, nullable=True)
    type: Mapped[CampaignType] = mapped_column(SAEnum(CampaignType), default=CampaignType.general)
    is_master: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[CampaignStatus] = mapped_column(SAEnum(CampaignStatus), default=CampaignStatus.draft)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    non_participation_penalty: Mapped[int] = mapped_column(Integer, default=0)
    tournament_id: Mapped[str] = mapped_column(String, ForeignKey("tournaments.id"), nullable=True) # Temporarily nullable
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), nullable=True)
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"), nullable=True)
    parent_campaign_id: Mapped[str] = mapped_column(String, ForeignKey("campaigns.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    questions: Mapped[list["CampaignQuestion"]] = relationship("CampaignQuestion", back_populates="campaign", cascade="all, delete-orphan", order_by="CampaignQuestion.order_index")
    responses: Mapped[list["CampaignResponse"]] = relationship("CampaignResponse", back_populates="campaign", cascade="all, delete-orphan")


class CampaignQuestion(Base):
    __tablename__ = "campaign_questions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    campaign_id: Mapped[str] = mapped_column(String, ForeignKey("campaigns.id"))
    question_text: Mapped[str] = mapped_column(String)
    question_type: Mapped[QuestionType] = mapped_column(SAEnum(QuestionType))
    # For toggle/multiple_choice/dropdown: list of option strings
    options: Mapped[dict] = mapped_column(JSON, nullable=True)
    # Correct answer(s): string, list, or number depending on type
    correct_answer: Mapped[dict] = mapped_column(JSON, nullable=True)
    # Scoring: exact_match_points, wrong_answer_points, within_range_points (free_number only)
    scoring_rules: Mapped[dict] = mapped_column(JSON)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False)

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="questions")
    answers: Mapped[list["CampaignAnswer"]] = relationship("CampaignAnswer", back_populates="question", cascade="all, delete-orphan")


class CampaignResponse(Base):
    __tablename__ = "campaign_responses"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    campaign_id: Mapped[str] = mapped_column(String, ForeignKey("campaigns.id"))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"), nullable=True)
    total_points: Mapped[int] = mapped_column(Integer, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="responses")
    answers: Mapped[list["CampaignAnswer"]] = relationship("CampaignAnswer", back_populates="response", cascade="all, delete-orphan")


class CampaignAnswer(Base):
    __tablename__ = "campaign_answers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    response_id: Mapped[str] = mapped_column(String, ForeignKey("campaign_responses.id"))
    question_id: Mapped[str] = mapped_column(String, ForeignKey("campaign_questions.id"))
    # Stores string, list, or number depending on question type
    answer_value: Mapped[dict] = mapped_column(JSON)
    points_awarded: Mapped[int] = mapped_column(Integer, nullable=True)

    response: Mapped["CampaignResponse"] = relationship("CampaignResponse", back_populates="answers")
    question: Mapped["CampaignQuestion"] = relationship("CampaignQuestion", back_populates="answers")


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    status: Mapped[TournamentStatus] = mapped_column(SAEnum(TournamentStatus), default=TournamentStatus.upcoming)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    leagues: Mapped[list["League"]] = relationship("League", back_populates="tournament")
    matches: Mapped[list["Match"]] = relationship("Match", back_populates="tournament")


class LeagueAdminMapping(Base):
    __tablename__ = "league_admin_mappings"
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)


class LeagueUserMapping(Base):
    __tablename__ = "league_user_mappings"
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    remaining_powerups: Mapped[int] = mapped_column(Integer, default=0)


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
    starting_powerups: Mapped[int] = mapped_column(Integer, default=0)
    settings: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="leagues")

    participants: Mapped[list["User"]] = relationship("User", secondary="league_user_mappings", back_populates="joined_leagues")
    admins: Mapped[list["User"]] = relationship("User", secondary="league_admin_mappings", back_populates="managed_leagues")
    mapped_campaigns: Mapped[list["Campaign"]] = relationship("Campaign", secondary="league_campaign_mappings")


class CampaignMatchResult(Base):
    __tablename__ = "campaign_match_results"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    campaign_id: Mapped[str] = mapped_column(String, ForeignKey("campaigns.id"))
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"))
    # Stores correct answer(s) for the campaign questions in the context of this match
    correct_answers: Mapped[dict] = mapped_column(JSON) # {question_id: answer_value}
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class LeaderboardCache(Base):
    __tablename__ = "leaderboard_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    tournament_id: Mapped[str] = mapped_column(String, ForeignKey("tournaments.id"), nullable=True)
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), nullable=True)
    total_points: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
