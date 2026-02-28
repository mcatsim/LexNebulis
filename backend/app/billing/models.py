import enum
import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, Enum, ForeignKey, Integer, Sequence, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import TimestampMixin, UUIDBase

invoice_number_seq = Sequence("invoice_number_seq", start=1001)


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"
    void = "void"


class PaymentMethod(str, enum.Enum):
    check = "check"
    ach = "ach"
    credit_card = "credit_card"
    cash = "cash"
    other = "other"


class TimeEntry(UUIDBase, TimestampMixin):
    __tablename__ = "time_entries"

    matter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("matters.id"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    billable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    rate_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)

    matter = relationship("Matter", back_populates="time_entries", lazy="selectin")
    user = relationship("User", back_populates="time_entries", lazy="selectin")
    invoice = relationship("Invoice", back_populates="time_entries", lazy="selectin")


class RateSchedule(UUIDBase):
    __tablename__ = "rate_schedules"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    matter_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("matters.id"), nullable=True)
    rate_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)


class Invoice(UUIDBase, TimestampMixin):
    __tablename__ = "invoices"

    invoice_number: Mapped[int] = mapped_column(Integer, invoice_number_seq, server_default=invoice_number_seq.next_value(), unique=True)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    matter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("matters.id"), nullable=False, index=True)
    issued_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal_cents: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    tax_cents: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    total_cents: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), default=InvoiceStatus.draft, nullable=False)
    pdf_storage_key: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    time_entries = relationship("TimeEntry", back_populates="invoice", lazy="selectin")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", lazy="selectin", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", lazy="selectin")
    client = relationship("Client", lazy="selectin")
    matter = relationship("Matter", lazy="selectin")


class InvoiceLineItem(UUIDBase):
    __tablename__ = "invoice_line_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    time_entry_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("time_entries.id"), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    rate_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)

    invoice = relationship("Invoice", back_populates="line_items")


class Payment(UUIDBase):
    __tablename__ = "payments"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False, index=True)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    invoice = relationship("Invoice", back_populates="payments")
