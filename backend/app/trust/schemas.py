import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.trust.models import TrustEntryType


class TrustAccountCreate(BaseModel):
    account_name: str = Field(min_length=1, max_length=255)
    bank_name: str = Field(min_length=1, max_length=255)
    account_number: str = Field(min_length=1)
    routing_number: str = Field(min_length=1)


class TrustAccountResponse(BaseModel):
    id: uuid.UUID
    account_name: str
    bank_name: str
    balance_cents: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TrustLedgerEntryCreate(BaseModel):
    trust_account_id: uuid.UUID
    client_id: uuid.UUID
    matter_id: uuid.UUID | None = None
    entry_type: TrustEntryType
    amount_cents: int = Field(ge=1)
    description: str = Field(min_length=1)
    reference_number: str | None = None
    entry_date: date


class TrustLedgerEntryResponse(BaseModel):
    id: uuid.UUID
    trust_account_id: uuid.UUID
    client_id: uuid.UUID
    matter_id: uuid.UUID | None
    entry_type: TrustEntryType
    amount_cents: int
    running_balance_cents: int
    description: str
    reference_number: str | None
    entry_date: date
    created_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class TrustReconciliationCreate(BaseModel):
    trust_account_id: uuid.UUID
    reconciliation_date: date
    statement_balance_cents: int
    notes: str | None = None


class TrustReconciliationResponse(BaseModel):
    id: uuid.UUID
    trust_account_id: uuid.UUID
    reconciliation_date: date
    statement_balance_cents: int
    ledger_balance_cents: int
    is_balanced: bool
    notes: str | None
    performed_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
