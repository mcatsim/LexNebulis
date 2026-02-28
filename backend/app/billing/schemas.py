import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.billing.models import InvoiceStatus, PaymentMethod


# Time Entries
class TimeEntryCreate(BaseModel):
    matter_id: uuid.UUID
    date: date
    duration_minutes: int = Field(ge=1)
    description: str = Field(min_length=1)
    billable: bool = True
    rate_cents: int = Field(ge=0)


class TimeEntryUpdate(BaseModel):
    date: date | None = None
    duration_minutes: int | None = Field(default=None, ge=1)
    description: str | None = Field(default=None, min_length=1)
    billable: bool | None = None
    rate_cents: int | None = Field(default=None, ge=0)


class TimeEntryResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    user_id: uuid.UUID
    date: date
    duration_minutes: int
    description: str
    billable: bool
    rate_cents: int
    invoice_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Rate Schedules
class RateScheduleCreate(BaseModel):
    user_id: uuid.UUID
    matter_id: uuid.UUID | None = None
    rate_cents: int = Field(ge=0)
    effective_date: date


class RateScheduleResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    matter_id: uuid.UUID | None
    rate_cents: int
    effective_date: date

    model_config = {"from_attributes": True}


# Invoices
class InvoiceCreate(BaseModel):
    client_id: uuid.UUID
    matter_id: uuid.UUID
    issued_date: date | None = None
    due_date: date | None = None
    notes: str | None = None
    time_entry_ids: list[uuid.UUID] = []


class InvoiceLineItemCreate(BaseModel):
    description: str = Field(min_length=1)
    quantity: int = Field(ge=1, default=1)
    rate_cents: int = Field(ge=0)
    amount_cents: int = Field(ge=0)
    time_entry_id: uuid.UUID | None = None


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: int
    client_id: uuid.UUID
    matter_id: uuid.UUID
    issued_date: date | None
    due_date: date | None
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    status: InvoiceStatus
    pdf_storage_key: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceLineItemResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    time_entry_id: uuid.UUID | None
    description: str
    quantity: int
    rate_cents: int
    amount_cents: int

    model_config = {"from_attributes": True}


# Payments
class PaymentCreate(BaseModel):
    invoice_id: uuid.UUID
    amount_cents: int = Field(ge=1)
    payment_date: date
    method: PaymentMethod
    reference_number: str | None = None
    notes: str | None = None


class PaymentResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount_cents: int
    payment_date: date
    method: PaymentMethod
    reference_number: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
