import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class SignatureRequestStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    partially_signed = "partially_signed"
    completed = "completed"
    expired = "expired"
    cancelled = "cancelled"


class SignerStatus(str, enum.Enum):
    pending = "pending"
    viewed = "viewed"
    signed = "signed"
    declined = "declined"


class SignatureRequest(UUIDBase, TimestampMixin):
    __tablename__ = "signature_requests"

    document_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("documents.id"), nullable=False, index=True)
    matter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[SignatureRequestStatus] = mapped_column(
        Enum(SignatureRequestStatus, name="signaturerequeststatus"),
        default=SignatureRequestStatus.draft,
        nullable=False,
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    certificate_storage_key: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    signers = relationship("Signer", back_populates="signature_request", lazy="selectin", cascade="all, delete-orphan")
    document = relationship("Document", lazy="selectin")


class Signer(UUIDBase):
    __tablename__ = "signers"

    signature_request_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("signature_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[SignerStatus] = mapped_column(
        Enum(SignerStatus, name="signerstatus"),
        default=SignerStatus.pending,
        nullable=False,
    )
    access_token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    signed_user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    decline_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    signature_request = relationship("SignatureRequest", back_populates="signers")
    audit_entries = relationship("SignatureAuditEntry", back_populates="signer", lazy="selectin")


class SignatureAuditEntry(UUIDBase):
    __tablename__ = "signature_audit_entries"

    signature_request_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("signature_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    signer_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("signers.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    signer = relationship("Signer", back_populates="audit_entries")
