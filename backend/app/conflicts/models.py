import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class ConflictStatus(str, enum.Enum):
    clear = "clear"
    potential_conflict = "potential_conflict"
    confirmed_conflict = "confirmed_conflict"


class MatchType(str, enum.Enum):
    exact = "exact"
    fuzzy = "fuzzy"
    phonetic = "phonetic"
    email = "email"


class MatchResolution(str, enum.Enum):
    not_reviewed = "not_reviewed"
    cleared = "cleared"
    flagged = "flagged"
    waiver_obtained = "waiver_obtained"


class ConflictCheck(UUIDBase, TimestampMixin):
    __tablename__ = "conflict_checks"

    checked_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    search_name: Mapped[str] = mapped_column(String(255), nullable=False)
    search_organization: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    matter_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("matters.id"), nullable=True, index=True)
    status: Mapped[ConflictStatus] = mapped_column(
        Enum(ConflictStatus), nullable=False, default=ConflictStatus.clear
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    matches = relationship("ConflictMatch", back_populates="conflict_check", lazy="selectin", cascade="all, delete-orphan")
    checked_by_user = relationship("User", lazy="selectin", foreign_keys=[checked_by])
    matter = relationship("Matter", lazy="selectin")


class ConflictMatch(UUIDBase):
    __tablename__ = "conflict_matches"

    conflict_check_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("conflict_checks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    matched_entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    matched_entity_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False)
    matched_name: Mapped[str] = mapped_column(String(500), nullable=False)
    match_type: Mapped[MatchType] = mapped_column(Enum(MatchType), nullable=False)
    match_score: Mapped[float] = mapped_column(Float, nullable=False)
    relationship_context: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    resolution: Mapped[MatchResolution] = mapped_column(
        Enum(MatchResolution), nullable=False, default=MatchResolution.not_reviewed
    )
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    conflict_check = relationship("ConflictCheck", back_populates="matches")
    resolved_by_user = relationship("User", lazy="selectin", foreign_keys=[resolved_by])


class EthicalWall(UUIDBase):
    __tablename__ = "ethical_walls"

    matter_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("matters.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    matter = relationship("Matter", lazy="selectin")
    user = relationship("User", lazy="selectin", foreign_keys=[user_id])
    created_by_user = relationship("User", lazy="selectin", foreign_keys=[created_by])
