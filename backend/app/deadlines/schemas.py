import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.deadlines.models import OffsetType

# --- Court Rule Set ---


class CourtRuleSetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    jurisdiction: str = Field(min_length=1, max_length=255)
    court_type: Optional[str] = Field(default=None, max_length=100)


class DeadlineRuleCreate(BaseModel):
    rule_set_id: uuid.UUID
    name: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    trigger_event: str = Field(min_length=1, max_length=255)
    offset_days: int
    offset_type: OffsetType = OffsetType.calendar_days
    creates_event_type: str = Field(default="deadline", max_length=100)
    is_active: bool = True
    sort_order: int = 0


class DeadlineRuleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    trigger_event: Optional[str] = Field(default=None, min_length=1, max_length=255)
    offset_days: Optional[int] = None
    offset_type: Optional[OffsetType] = None
    creates_event_type: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class DeadlineRuleResponse(BaseModel):
    id: uuid.UUID
    rule_set_id: uuid.UUID
    name: str
    description: Optional[str]
    trigger_event: str
    offset_days: int
    offset_type: OffsetType
    creates_event_type: str
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class CourtRuleSetResponse(BaseModel):
    id: uuid.UUID
    name: str
    jurisdiction: str
    court_type: Optional[str]
    is_active: bool
    rules: list[DeadlineRuleResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Trigger Events ---


class TriggerEventCreate(BaseModel):
    matter_id: uuid.UUID
    trigger_name: str = Field(min_length=1, max_length=255)
    trigger_date: date
    notes: Optional[str] = None


class TriggerEventUpdate(BaseModel):
    trigger_date: Optional[date] = None
    notes: Optional[str] = None


class TriggerEventResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    trigger_name: str
    trigger_date: date
    notes: Optional[str]
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Generated Deadlines ---


class GeneratedDeadlineResponse(BaseModel):
    id: uuid.UUID
    calendar_event_id: uuid.UUID
    trigger_event_id: uuid.UUID
    deadline_rule_id: uuid.UUID
    matter_id: uuid.UUID
    computed_date: date
    rule_name: Optional[str] = None
    event_title: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Matter Deadline Config ---


class MatterDeadlineConfigCreate(BaseModel):
    matter_id: uuid.UUID
    rule_set_id: uuid.UUID


class MatterDeadlineConfigResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    rule_set_id: uuid.UUID
    created_by: Optional[uuid.UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Statute of Limitations ---


class StatuteOfLimitationsCreate(BaseModel):
    matter_id: uuid.UUID
    description: str = Field(min_length=1, max_length=500)
    expiration_date: date
    statute_reference: Optional[str] = Field(default=None, max_length=255)
    reminder_days: Optional[list[int]] = None


class StatuteOfLimitationsUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1, max_length=500)
    expiration_date: Optional[date] = None
    statute_reference: Optional[str] = Field(default=None, max_length=255)
    reminder_days: Optional[list[int]] = None
    is_active: Optional[bool] = None


class StatuteOfLimitationsResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    description: str
    expiration_date: date
    statute_reference: Optional[str]
    reminder_days: Optional[list[int]]
    is_active: bool
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
    days_remaining: Optional[int] = None

    model_config = {"from_attributes": True}


class SOLWarningResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    description: str
    expiration_date: date
    statute_reference: Optional[str]
    reminder_days: Optional[list[int]]
    is_active: bool
    days_remaining: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
