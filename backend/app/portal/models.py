import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class SenderType(str, enum.Enum):
    staff = "staff"
    client = "client"


class ClientUser(UUIDBase, TimestampMixin):
    """Separate user table for client portal login (NOT the staff User table)."""

    __tablename__ = "client_users"

    client_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("clients.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    client = relationship("Client", lazy="selectin")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Message(UUIDBase):
    """Threaded secure messaging between staff and clients, per-matter."""

    __tablename__ = "messages"

    matter_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("matters.id"), nullable=False, index=True)
    sender_type: Mapped[SenderType] = mapped_column(Enum(SenderType), nullable=False)
    sender_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)
    sender_client_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("client_users.id"), nullable=True
    )
    subject: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    parent_message_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("messages.id"), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    matter = relationship("Matter", lazy="selectin")
    sender_staff = relationship("User", lazy="selectin")
    sender_client_user = relationship("ClientUser", lazy="selectin")
    parent_message = relationship("Message", remote_side="Message.id", lazy="selectin")


class SharedDocument(UUIDBase):
    """Documents explicitly shared with the client portal."""

    __tablename__ = "shared_documents"

    document_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("documents.id"), nullable=False, index=True)
    matter_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("matters.id"), nullable=False, index=True)
    shared_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    shared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    document = relationship("Document", lazy="selectin")
    matter = relationship("Matter", lazy="selectin")
    shared_by_user = relationship("User", lazy="selectin")
