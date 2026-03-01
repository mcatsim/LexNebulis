import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class ExportFormat(str, enum.Enum):
    iif = "iif"
    csv = "csv"
    qbo_json = "qbo_json"


class AccountType(str, enum.Enum):
    income = "income"
    expense = "expense"
    asset = "asset"
    liability = "liability"
    equity = "equity"


class ChartOfAccounts(UUIDBase, TimestampMixin):
    __tablename__ = "chart_of_accounts"

    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(Enum(AccountType), nullable=False, index=True)
    parent_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    quickbooks_account_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    xero_account_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)

    mappings = relationship("AccountMapping", back_populates="account", lazy="selectin", cascade="all, delete-orphan")


class AccountMapping(UUIDBase):
    __tablename__ = "account_mappings"

    source_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("chart_of_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    account = relationship("ChartOfAccounts", back_populates="mappings")


class ExportHistory(UUIDBase):
    __tablename__ = "export_history"

    export_format: Mapped[ExportFormat] = mapped_column(Enum(ExportFormat), nullable=False)
    export_type: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    file_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    storage_key: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    exported_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
