import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class PaymentProcessor(str, enum.Enum):
    stripe = "stripe"
    lawpay = "lawpay"
    manual = "manual"


class PaymentLinkStatus(str, enum.Enum):
    active = "active"
    paid = "paid"
    expired = "expired"
    cancelled = "cancelled"


class PaymentAccountType(str, enum.Enum):
    operating = "operating"
    trust = "trust"


class PaymentSettings(UUIDBase, TimestampMixin):
    __tablename__ = "payment_settings"

    processor: Mapped[PaymentProcessor] = mapped_column(
        Enum(PaymentProcessor, name="paymentprocessor"),
        default=PaymentProcessor.manual,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    webhook_secret_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    publishable_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    account_type: Mapped[PaymentAccountType] = mapped_column(
        Enum(PaymentAccountType, name="paymentaccounttype"),
        default=PaymentAccountType.operating,
        nullable=False,
    )
    surcharge_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    surcharge_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)


class PaymentLink(UUIDBase, TimestampMixin):
    __tablename__ = "payment_links"

    invoice_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("invoices.id"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("clients.id"), nullable=False, index=True)
    matter_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("matters.id"), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[PaymentLinkStatus] = mapped_column(
        Enum(PaymentLinkStatus, name="paymentlinkstatus"),
        default=PaymentLinkStatus.active,
        nullable=False,
    )
    access_token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    processor: Mapped[PaymentProcessor] = mapped_column(
        Enum(PaymentProcessor, name="paymentprocessor"),
        nullable=False,
    )
    processor_session_id: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_amount_cents: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    surcharge_cents: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    processor_fee_cents: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    payer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    processor_reference: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    invoice = relationship("Invoice", lazy="selectin")
    client = relationship("Client", lazy="selectin")


class WebhookEvent(UUIDBase):
    __tablename__ = "webhook_events"

    processor: Mapped[PaymentProcessor] = mapped_column(
        Enum(PaymentProcessor, name="paymentprocessor"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(255), nullable=False)
    event_id: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, index=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
