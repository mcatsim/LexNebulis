import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.payments.models import PaymentAccountType, PaymentLinkStatus, PaymentProcessor

# ── Payment Settings ─────────────────────────────────────────────────


class PaymentSettingsCreate(BaseModel):
    processor: PaymentProcessor = PaymentProcessor.manual
    is_active: bool = False
    api_key: Optional[str] = None
    webhook_secret: Optional[str] = None
    publishable_key: Optional[str] = None
    account_type: PaymentAccountType = PaymentAccountType.operating
    surcharge_enabled: bool = False
    surcharge_rate: float = Field(default=0.0, ge=0.0, le=1.0)


class PaymentSettingsUpdate(BaseModel):
    processor: Optional[PaymentProcessor] = None
    is_active: Optional[bool] = None
    api_key: Optional[str] = None
    webhook_secret: Optional[str] = None
    publishable_key: Optional[str] = None
    account_type: Optional[PaymentAccountType] = None
    surcharge_enabled: Optional[bool] = None
    surcharge_rate: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class PaymentSettingsResponse(BaseModel):
    id: uuid.UUID
    processor: PaymentProcessor
    is_active: bool
    api_key_masked: Optional[str] = None
    webhook_secret_masked: Optional[str] = None
    publishable_key: Optional[str]
    account_type: PaymentAccountType
    surcharge_enabled: bool
    surcharge_rate: float
    webhook_url: Optional[str] = None
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Payment Links ────────────────────────────────────────────────────


class CreatePaymentLinkRequest(BaseModel):
    invoice_id: uuid.UUID
    description: Optional[str] = Field(default=None, max_length=500)
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)


class PaymentLinkResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    client_id: uuid.UUID
    matter_id: Optional[uuid.UUID]
    created_by: uuid.UUID
    amount_cents: int
    description: Optional[str]
    status: PaymentLinkStatus
    access_token: str
    processor: PaymentProcessor
    processor_session_id: Optional[str]
    expires_at: Optional[datetime]
    paid_at: Optional[datetime]
    paid_amount_cents: Optional[int]
    surcharge_cents: int
    processor_fee_cents: int
    payer_email: Optional[str]
    payer_name: Optional[str]
    processor_reference: Optional[str]
    payment_url: Optional[str] = None
    invoice_number: Optional[int] = None
    client_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompletePaymentRequest(BaseModel):
    payer_email: Optional[str] = None
    payer_name: Optional[str] = None
    processor_reference: Optional[str] = None
    paid_amount_cents: Optional[int] = None


# ── Public Payment Info ──────────────────────────────────────────────


class PublicPaymentInfo(BaseModel):
    invoice_number: Optional[int] = None
    amount_cents: int
    surcharge_cents: int
    total_cents: int
    description: Optional[str] = None
    client_name: Optional[str] = None
    firm_name: str
    processor: PaymentProcessor
    status: PaymentLinkStatus
    expires_at: Optional[datetime] = None


# ── Webhook Events ───────────────────────────────────────────────────


class WebhookEventResponse(BaseModel):
    id: uuid.UUID
    processor: PaymentProcessor
    event_type: str
    event_id: Optional[str]
    processed: bool
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Payment Summary Report ───────────────────────────────────────────


class ProcessorBreakdown(BaseModel):
    processor: PaymentProcessor
    count: int
    total_cents: int
    fees_cents: int


class PaymentSummaryReport(BaseModel):
    total_processed_cents: int
    total_fees_cents: int
    count: int
    by_processor: list[ProcessorBreakdown]


# ── Send Link Notification ───────────────────────────────────────────


class SendPaymentLinkRequest(BaseModel):
    recipient_email: Optional[str] = None
    message: Optional[str] = None


class SendPaymentLinkResponse(BaseModel):
    status: str
    message: str
