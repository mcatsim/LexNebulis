import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class EventType(str, enum.Enum):
    court_date = "court_date"
    deadline = "deadline"
    filing = "filing"
    meeting = "meeting"
    reminder = "reminder"


class EventStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"


class CalendarEvent(UUIDBase, TimestampMixin):
    __tablename__ = "calendar_events"

    matter_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_type: Mapped[EventType] = mapped_column(Enum(EventType), nullable=False, default=EventType.meeting)
    start_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_datetime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True, index=True)
    reminder_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus), nullable=False, default=EventStatus.scheduled)
    created_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)

    matter = relationship("Matter", back_populates="calendar_events", lazy="selectin")
    assigned_user = relationship("User", back_populates="calendar_events", foreign_keys=[assigned_to], lazy="selectin")
