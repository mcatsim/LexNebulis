import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class CloudStorageProviderType(str, enum.Enum):
    google_drive = "google_drive"
    dropbox = "dropbox"
    box = "box"
    onedrive = "onedrive"


class CloudStorageConnection(UUIDBase, TimestampMixin):
    __tablename__ = "cloud_storage_connections"

    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    account_email: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    root_folder_id: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    root_folder_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    connected_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)

    user = relationship("User", lazy="selectin")
    links = relationship("CloudStorageLink", back_populates="connection", lazy="selectin")


class CloudStorageLink(UUIDBase):
    __tablename__ = "cloud_storage_links"

    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    matter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connection_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("cloud_storage_connections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cloud_file_id: Mapped[str] = mapped_column(String(500), nullable=False)
    cloud_file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    cloud_file_url: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    cloud_mime_type: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    cloud_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    cloud_modified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    link_type: Mapped[str] = mapped_column(String(20), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    document = relationship("Document", lazy="selectin")
    matter = relationship("Matter", lazy="selectin")
    connection = relationship("CloudStorageConnection", back_populates="links", lazy="selectin")
    creator = relationship("User", lazy="selectin")
