import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class OffsetType(str, enum.Enum):
    calendar_days = "calendar_days"
    business_days = "business_days"


class CourtRuleSet(UUIDBase, TimestampMixin):
    __tablename__ = "court_rule_sets"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    court_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    rules: Mapped[list["DeadlineRule"]] = relationship(
        "DeadlineRule",
        back_populates="rule_set",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="DeadlineRule.sort_order",
    )


class DeadlineRule(UUIDBase):
    __tablename__ = "deadline_rules"

    rule_set_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("court_rule_sets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trigger_event: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    offset_days: Mapped[int] = mapped_column(Integer, nullable=False)
    offset_type: Mapped[OffsetType] = mapped_column(
        Enum(OffsetType, name="offsettype"), nullable=False, default=OffsetType.calendar_days
    )
    creates_event_type: Mapped[str] = mapped_column(String(100), nullable=False, default="deadline")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    rule_set: Mapped["CourtRuleSet"] = relationship("CourtRuleSet", back_populates="rules", lazy="selectin")


class MatterDeadlineConfig(UUIDBase):
    __tablename__ = "matter_deadline_configs"

    matter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_set_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("court_rule_sets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    rule_set: Mapped["CourtRuleSet"] = relationship("CourtRuleSet", lazy="selectin")


class TriggerEvent(UUIDBase, TimestampMixin):
    __tablename__ = "trigger_events"

    matter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trigger_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    trigger_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)

    generated_deadlines: Mapped[list["GeneratedDeadline"]] = relationship(
        "GeneratedDeadline", back_populates="trigger_event", lazy="selectin", cascade="all, delete-orphan"
    )


class GeneratedDeadline(UUIDBase):
    __tablename__ = "generated_deadlines"

    calendar_event_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trigger_event_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("trigger_events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    deadline_rule_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("deadline_rules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    matter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    computed_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    trigger_event: Mapped["TriggerEvent"] = relationship("TriggerEvent", back_populates="generated_deadlines")
    deadline_rule: Mapped["DeadlineRule"] = relationship("DeadlineRule", lazy="selectin")


class StatuteOfLimitations(UUIDBase, TimestampMixin):
    __tablename__ = "statutes_of_limitations"

    matter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    expiration_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    statute_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reminder_days: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
