import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.ledes.models import UTBMSCodeType


# ── UTBMS Codes ───────────────────────────────────────────────────────────
class UTBMSCodeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    code_type: UTBMSCodeType
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    practice_area: Optional[str] = Field(default=None, max_length=100)
    is_active: bool = True


class UTBMSCodeUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=20)
    code_type: Optional[UTBMSCodeType] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    practice_area: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None


class UTBMSCodeResponse(BaseModel):
    id: uuid.UUID
    code: str
    code_type: UTBMSCodeType
    name: str
    description: Optional[str]
    practice_area: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


# ── Billing Guidelines ───────────────────────────────────────────────────
class BillingGuidelineCreate(BaseModel):
    client_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    rate_cap_cents: Optional[int] = Field(default=None, ge=0)
    daily_hour_cap: Optional[float] = Field(default=None, gt=0)
    block_billing_prohibited: bool = False
    task_code_required: bool = False
    activity_code_required: bool = False
    restricted_codes: Optional[list[str]] = None
    notes: Optional[str] = None
    is_active: bool = True


class BillingGuidelineUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    rate_cap_cents: Optional[int] = Field(default=None, ge=0)
    daily_hour_cap: Optional[float] = Field(default=None, gt=0)
    block_billing_prohibited: Optional[bool] = None
    task_code_required: Optional[bool] = None
    activity_code_required: Optional[bool] = None
    restricted_codes: Optional[list[str]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class BillingGuidelineResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    name: str
    rate_cap_cents: Optional[int]
    daily_hour_cap: Optional[float]
    block_billing_prohibited: bool
    task_code_required: bool
    activity_code_required: bool
    restricted_codes: Optional[list[str]]
    notes: Optional[str]
    is_active: bool
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Time Entry Codes ─────────────────────────────────────────────────────
class TimeEntryCodeAssign(BaseModel):
    utbms_code_id: uuid.UUID


class TimeEntryCodeResponse(BaseModel):
    id: uuid.UUID
    time_entry_id: uuid.UUID
    utbms_code_id: uuid.UUID
    created_at: datetime
    code: Optional[str] = None
    code_type: Optional[UTBMSCodeType] = None
    code_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Compliance ────────────────────────────────────────────────────────────
class ComplianceCheckRequest(BaseModel):
    time_entry_id: uuid.UUID
    client_id: uuid.UUID


class ComplianceViolation(BaseModel):
    rule: str
    message: str
    severity: str  # "error" | "warning"


class ComplianceCheckResponse(BaseModel):
    compliant: bool
    violations: list[ComplianceViolation]


# ── Block Billing Detection ──────────────────────────────────────────────
class BlockBillingRequest(BaseModel):
    description: str
    duration_minutes: Optional[int] = None


class BlockBillingResponse(BaseModel):
    is_block_billing: bool
    reasons: list[str]
    confidence: str  # "low" | "medium" | "high"
