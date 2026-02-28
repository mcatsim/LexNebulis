import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.intake.models import LeadSource, PipelineStage

# ── Lead Schemas ──────────────────────────────────────────────────────


class LeadCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    organization: Optional[str] = Field(default=None, max_length=255)
    source: LeadSource = LeadSource.other
    source_detail: Optional[str] = Field(default=None, max_length=500)
    stage: PipelineStage = PipelineStage.new
    practice_area: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    estimated_value_cents: Optional[int] = None
    assigned_to: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    custom_fields: Optional[dict] = None


class LeadUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    organization: Optional[str] = Field(default=None, max_length=255)
    source: Optional[LeadSource] = None
    source_detail: Optional[str] = Field(default=None, max_length=500)
    stage: Optional[PipelineStage] = None
    practice_area: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    estimated_value_cents: Optional[int] = None
    assigned_to: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    custom_fields: Optional[dict] = None


class LeadResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    organization: Optional[str]
    source: LeadSource
    source_detail: Optional[str]
    stage: PipelineStage
    practice_area: Optional[str]
    description: Optional[str]
    estimated_value_cents: Optional[int]
    assigned_to: Optional[uuid.UUID]
    converted_client_id: Optional[uuid.UUID]
    converted_matter_id: Optional[uuid.UUID]
    converted_at: Optional[datetime]
    notes: Optional[str]
    custom_fields: Optional[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConvertLeadRequest(BaseModel):
    """Request to convert a lead into a client and optionally a matter."""

    client_type: str = "individual"
    organization_name: Optional[str] = Field(default=None, max_length=255)
    create_matter: bool = False
    matter_title: Optional[str] = Field(default=None, max_length=500)
    litigation_type: Optional[str] = "other"
    jurisdiction: Optional[str] = Field(default=None, max_length=255)


# ── IntakeForm Schemas ────────────────────────────────────────────────


class IntakeFormCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    practice_area: Optional[str] = Field(default=None, max_length=100)
    fields_json: list
    is_active: bool = True
    is_public: bool = True


class IntakeFormUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    practice_area: Optional[str] = Field(default=None, max_length=100)
    fields_json: Optional[list] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None


class IntakeFormResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    practice_area: Optional[str]
    fields_json: list
    is_active: bool
    is_public: bool
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── IntakeSubmission Schemas ──────────────────────────────────────────


class IntakeSubmissionCreate(BaseModel):
    data_json: dict


class IntakeSubmissionReview(BaseModel):
    lead_id: Optional[uuid.UUID] = None
    create_lead: bool = False
    lead_first_name: Optional[str] = Field(default=None, max_length=100)
    lead_last_name: Optional[str] = Field(default=None, max_length=100)
    lead_email: Optional[EmailStr] = None
    lead_phone: Optional[str] = Field(default=None, max_length=50)


class IntakeSubmissionResponse(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    lead_id: Optional[uuid.UUID]
    data_json: dict
    ip_address: Optional[str]
    user_agent: Optional[str]
    is_reviewed: bool
    reviewed_by: Optional[uuid.UUID]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Pipeline Summary ─────────────────────────────────────────────────


class PipelineStageSummary(BaseModel):
    stage: PipelineStage
    count: int
    total_value_cents: int


class PipelineSummaryResponse(BaseModel):
    stages: list[PipelineStageSummary]
    total_leads: int
    total_value_cents: int
