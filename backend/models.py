from datetime import datetime, UTC
import enum
from sqlalchemy import String, Integer, DateTime, Boolean, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from .database import Base

class MatchStatus(str, enum.Enum):
    upcoming = "upcoming"
    live = "live"
    completed = "completed"

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    google_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    avatar_url: Mapped[str] = mapped_column(String, nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    base_points: Mapped[int] = mapped_column(Integer, default=0)
    base_powerups: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class AllowlistedEmail(Base):
    __tablename__ = "allowlisted_emails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
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
    
    # Ground Truth Results (for scoring)
    winner: Mapped[str] = mapped_column(String, nullable=True)
    team1_powerplay_score: Mapped[int] = mapped_column(Integer, nullable=True)
    team2_powerplay_score: Mapped[int] = mapped_column(Integer, nullable=True)
    player_of_the_match: Mapped[str] = mapped_column(String, nullable=True)
    
    raw_result_json: Mapped[dict] = mapped_column(JSON, nullable=True)

class MatchV2(Base):
    __tablename__ = "matches_v2"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    external_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=True)
    team1: Mapped[str] = mapped_column(String)
    team2: Mapped[str] = mapped_column(String)
    venue: Mapped[str] = mapped_column(String)
    toss_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[MatchStatus] = mapped_column(SAEnum(MatchStatus))
    
    # V2 Dynamic Questions Data defined by Admin
    questions_json: Mapped[list] = mapped_column(JSON, nullable=True)
    
    # Ground Truth Results (for scoring)
    winner: Mapped[str] = mapped_column(String, nullable=True)
    team1_powerplay_score: Mapped[int] = mapped_column(Integer, nullable=True)
    team2_powerplay_score: Mapped[int] = mapped_column(Integer, nullable=True)
    player_of_the_match: Mapped[str] = mapped_column(String, nullable=True)
    
    raw_result_json: Mapped[dict] = mapped_column(JSON, nullable=True)

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
    use_powerup: Mapped[str] = mapped_column(String, default="No") # "Yes" or "No"
    

    points_awarded: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class PredictionV2(Base):
    __tablename__ = "predictions_v2"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches_v2.id"))
    
    # V2 Dynamic Answers Data provided by user
    answers_json: Mapped[dict] = mapped_column(JSON, nullable=True)
    
    # Flattened Prediction Fields (kept for backward compatibility)
    match_winner: Mapped[str] = mapped_column(String, nullable=True)
    team1_powerplay: Mapped[int] = mapped_column(Integer, nullable=True)
    team2_powerplay: Mapped[int] = mapped_column(Integer, nullable=True)
    player_of_the_match: Mapped[str] = mapped_column(String, nullable=True)
    use_powerup: Mapped[str] = mapped_column(String, default="No") # "Yes" or "No"
    
    points_awarded: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class ScoringRule(Base):
    __tablename__ = "scoring_rules"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    config_json: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

class QuestionTemplate(Base):
    __tablename__ = "question_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    questions_json: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

class LeaderboardEntry(Base):
    __tablename__ = "leaderboard_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"))
    points: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
