import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, UUIDBase


class Document(UUIDBase):
    __tablename__ = "documents"

    matter_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    parent_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("documents.id"), nullable=True)
    tags_json: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    matter = relationship("Matter", back_populates="documents", lazy="selectin")
    uploader = relationship("User", lazy="selectin")
    parent = relationship("Document", remote_side="Document.id", lazy="selectin")


class DocumentTag(UUIDBase):
    __tablename__ = "document_tags"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#228BE6", nullable=False)
