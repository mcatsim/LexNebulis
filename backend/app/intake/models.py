import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class LeadSource(str, enum.Enum):
    website = "website"
    referral = "referral"
    social_media = "social_media"
    advertisement = "advertisement"
    walk_in = "walk_in"
    phone = "phone"
    other = "other"


class PipelineStage(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    proposal_sent = "proposal_sent"
    retained = "retained"
    declined = "declined"
    lost = "lost"


class Lead(UUIDBase, TimestampMixin):
    __tablename__ = "leads"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    organization: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source: Mapped[LeadSource] = mapped_column(Enum(LeadSource), nullable=False, default=LeadSource.other)
    source_detail: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    stage: Mapped[PipelineStage] = mapped_column(
        Enum(PipelineStage), nullable=False, default=PipelineStage.new, index=True
    )
    practice_area: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estimated_value_cents: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    converted_client_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("clients.id"), nullable=True)
    converted_matter_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("matters.id"), nullable=True)
    converted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Relationships
    assigned_user = relationship("User", foreign_keys=[assigned_to], lazy="selectin")
    converted_client = relationship("Client", lazy="selectin")
    converted_matter = relationship("Matter", lazy="selectin")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class IntakeForm(UUIDBase, TimestampMixin):
    __tablename__ = "intake_forms"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    practice_area: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fields_json: Mapped[list] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)


class IntakeSubmission(UUIDBase, TimestampMixin):
    __tablename__ = "intake_submissions"

    form_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("intake_forms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("leads.id"), nullable=True)
    data_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    form = relationship("IntakeForm", lazy="selectin")
    lead = relationship("Lead", lazy="selectin")
