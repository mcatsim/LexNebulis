import uuid
from datetime import date, datetime
from typing import Optional

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
    date: Optional[date] = None
    duration_minutes: Optional[int] = Field(default=None, ge=1)
    description: Optional[str] = Field(default=None, min_length=1)
    billable: Optional[bool] = None
    rate_cents: Optional[int] = Field(default=None, ge=0)


class TimeEntryResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    user_id: uuid.UUID
    date: date
    duration_minutes: int
    description: str
    billable: bool
    rate_cents: int
    invoice_id: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Rate Schedules
class RateScheduleCreate(BaseModel):
    user_id: uuid.UUID
    matter_id: Optional[uuid.UUID] = None
    rate_cents: int = Field(ge=0)
    effective_date: date


class RateScheduleResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    matter_id: Optional[uuid.UUID]
    rate_cents: int
    effective_date: date

    model_config = {"from_attributes": True}


# Invoices
class InvoiceCreate(BaseModel):
    client_id: uuid.UUID
    matter_id: uuid.UUID
    issued_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    time_entry_ids: list[uuid.UUID] = []


class InvoiceLineItemCreate(BaseModel):
    description: str = Field(min_length=1)
    quantity: int = Field(ge=1, default=1)
    rate_cents: int = Field(ge=0)
    amount_cents: int = Field(ge=0)
    time_entry_id: Optional[uuid.UUID] = None


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: int
    client_id: uuid.UUID
    matter_id: uuid.UUID
    issued_date: Optional[date]
    due_date: Optional[date]
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    status: InvoiceStatus
    pdf_storage_key: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceLineItemResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    time_entry_id: Optional[uuid.UUID]
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
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount_cents: int
    payment_date: date
    method: PaymentMethod
    reference_number: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
