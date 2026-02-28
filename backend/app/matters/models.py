import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, Enum, ForeignKey, Integer, Sequence, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import TimestampMixin, UUIDBase

matter_number_seq = Sequence("matter_number_seq", start=10001)


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

    matter_number: Mapped[int] = mapped_column(Integer, matter_number_seq, server_default=matter_number_seq.next_value(), unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    status: Mapped[MatterStatus] = mapped_column(Enum(MatterStatus), nullable=False, default=MatterStatus.open)
    litigation_type: Mapped[LitigationType] = mapped_column(Enum(LitigationType), nullable=False, default=LitigationType.other)
    jurisdiction: Mapped[str | None] = mapped_column(String(255), nullable=True)
    court_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    case_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    date_opened: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False)
    date_closed: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_attorney_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    client = relationship("Client", back_populates="matters", lazy="selectin")
    assigned_attorney = relationship("User", lazy="selectin")
    contacts = relationship("MatterContact", back_populates="matter", lazy="selectin", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="matter", lazy="selectin")
    time_entries = relationship("TimeEntry", back_populates="matter", lazy="selectin")
    calendar_events = relationship("CalendarEvent", back_populates="matter", lazy="selectin")


class MatterContact(UUIDBase):
    __tablename__ = "matter_contacts"

    matter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False)
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False, default="related")

    matter = relationship("Matter", back_populates="contacts")
    contact = relationship("Contact", lazy="selectin")
