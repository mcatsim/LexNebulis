import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class TemplateCategory(str, enum.Enum):
    engagement_letter = "engagement_letter"
    correspondence = "correspondence"
    pleading = "pleading"
    motion = "motion"
    contract = "contract"
    discovery = "discovery"
    other = "other"


class DocumentTemplate(UUIDBase, TimestampMixin):
    __tablename__ = "document_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    practice_area: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    category: Mapped[TemplateCategory] = mapped_column(
        Enum(TemplateCategory), nullable=False, default=TemplateCategory.other
    )
    storage_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)

    # Relationships
    creator = relationship("User", lazy="selectin")
    generated_documents = relationship("GeneratedDocument", back_populates="template", lazy="selectin")


class GeneratedDocument(UUIDBase):
    __tablename__ = "generated_documents"

    template_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("document_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    matter_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    generated_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    context_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    # Relationships
    template = relationship("DocumentTemplate", back_populates="generated_documents", lazy="selectin")
    matter = relationship("Matter", lazy="selectin")
    document = relationship("Document", lazy="selectin")
    generator = relationship("User", lazy="selectin")
