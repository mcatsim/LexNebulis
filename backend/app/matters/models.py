import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class MatterStatus(str, enum.Enum):
    open = "open"
    pending = "pending"
    closed = "closed"
    archived = "archived"


class LitigationType(str, enum.Enum):
    civil = "civil"
    criminal = "criminal"
    family = "family"
    corporate = "corporate"
    real_estate = "real_estate"
    immigration = "immigration"
    bankruptcy = "bankruptcy"
    tax = "tax"
    labor = "labor"
    ip = "intellectual_property"
    estate = "estate_planning"
    personal_injury = "personal_injury"
    other = "other"


class Matter(UUIDBase, TimestampMixin):
    __tablename__ = "matters"

    matter_number: Mapped[int] = mapped_column(Integer, unique=True, nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("clients.id"), nullable=False, index=True)
    status: Mapped[MatterStatus] = mapped_column(Enum(MatterStatus), nullable=False, default=MatterStatus.open)
    litigation_type: Mapped[LitigationType] = mapped_column(Enum(LitigationType), nullable=False, default=LitigationType.other)
    jurisdiction: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    court_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    case_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    date_opened: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False)
    date_closed: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_attorney_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    client = relationship("Client", back_populates="matters", lazy="selectin")
    assigned_attorney = relationship("User", lazy="selectin")
    contacts = relationship("MatterContact", back_populates="matter", lazy="selectin", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="matter", lazy="selectin")
    time_entries = relationship("TimeEntry", back_populates="matter", lazy="selectin")
    calendar_events = relationship("CalendarEvent", back_populates="matter", lazy="selectin")


class MatterContact(UUIDBase):
    __tablename__ = "matter_contacts"

    matter_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False)
    contact_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False, default="related")

    matter = relationship("Matter", back_populates="contacts")
    contact = relationship("Contact", lazy="selectin")
