import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class EmailDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class FiledEmail(UUIDBase, TimestampMixin):
    __tablename__ = "filed_emails"

    matter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filed_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    direction: Mapped[EmailDirection] = mapped_column(
        Enum(EmailDirection), nullable=False, default=EmailDirection.inbound
    )
    subject: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    from_address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    to_addresses: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    cc_addresses: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    bcc_addresses: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    date_sent: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    message_id: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, index=True)
    in_reply_to: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    thread_id: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, index=True)
    has_attachments: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attachment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    headers_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    matter = relationship("Matter", lazy="selectin")
    filed_by_user = relationship("User", lazy="selectin")
    attachments = relationship("EmailAttachment", back_populates="email", lazy="selectin", cascade="all, delete-orphan")


class EmailAttachment(UUIDBase):
    __tablename__ = "email_attachments"

    email_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("filed_emails.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    storage_key: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("documents.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    email = relationship("FiledEmail", back_populates="attachments")
    document = relationship("Document", lazy="selectin")


class EmailMatterSuggestion(UUIDBase):
    __tablename__ = "email_matter_suggestions"

    email_address: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    matter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    last_used: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    use_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
