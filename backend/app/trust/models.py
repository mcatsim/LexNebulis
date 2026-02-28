import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, UUIDBase


class TrustEntryType(str, enum.Enum):
    deposit = "deposit"
    disbursement = "disbursement"
    transfer = "transfer"


class TrustAccount(UUIDBase):
    __tablename__ = "trust_accounts"

    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_number_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    routing_number_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    balance_cents: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    ledger_entries = relationship("TrustLedgerEntry", back_populates="trust_account", lazy="selectin")
    reconciliations = relationship("TrustReconciliation", back_populates="trust_account", lazy="selectin")


class TrustLedgerEntry(UUIDBase):
    __tablename__ = "trust_ledger_entries"

    trust_account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("trust_accounts.id"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("clients.id"), nullable=False, index=True)
    matter_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("matters.id"), nullable=True)
    entry_type: Mapped[TrustEntryType] = mapped_column(Enum(TrustEntryType), nullable=False)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    running_balance_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    reference_number: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    trust_account = relationship("TrustAccount", back_populates="ledger_entries")
    client = relationship("Client", lazy="selectin")


class TrustReconciliation(UUIDBase):
    __tablename__ = "trust_reconciliations"

    trust_account_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("trust_accounts.id"), nullable=False)
    reconciliation_date: Mapped[date] = mapped_column(Date, nullable=False)
    statement_balance_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    ledger_balance_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    is_balanced: Mapped[bool] = mapped_column(Boolean, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    performed_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    trust_account = relationship("TrustAccount", back_populates="reconciliations")
