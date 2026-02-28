import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class UTBMSCodeType(str, enum.Enum):
    activity = "activity"
    expense = "expense"
    task = "task"
    phase = "phase"


class UTBMSCode(UUIDBase):
    __tablename__ = "utbms_codes"

    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    code_type: Mapped[UTBMSCodeType] = mapped_column(Enum(UTBMSCodeType), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    practice_area: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class BillingGuideline(UUIDBase, TimestampMixin):
    __tablename__ = "billing_guidelines"

    client_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    rate_cap_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    daily_hour_cap: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    block_billing_prohibited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    task_code_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    activity_code_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    restricted_codes: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)

    client = relationship("Client", lazy="selectin")


class TimeEntryCode(UUIDBase):
    __tablename__ = "time_entry_codes"

    time_entry_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("time_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    utbms_code_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("utbms_codes.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    utbms_code = relationship("UTBMSCode", lazy="selectin")
