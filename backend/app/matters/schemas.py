import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.matters.models import LitigationType, MatterStatus


class MatterCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    client_id: uuid.UUID
    status: MatterStatus = MatterStatus.open
    litigation_type: LitigationType = LitigationType.other
    jurisdiction: str | None = Field(default=None, max_length=255)
    court_name: str | None = Field(default=None, max_length=255)
    case_number: str | None = Field(default=None, max_length=100)
    date_opened: date | None = None
    description: str | None = None
    assigned_attorney_id: uuid.UUID | None = None
    notes: str | None = None


class MatterUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    status: MatterStatus | None = None
    litigation_type: LitigationType | None = None
    jurisdiction: str | None = Field(default=None, max_length=255)
    court_name: str | None = Field(default=None, max_length=255)
    case_number: str | None = Field(default=None, max_length=100)
    date_closed: date | None = None
    description: str | None = None
    assigned_attorney_id: uuid.UUID | None = None
    notes: str | None = None


class MatterContactAdd(BaseModel):
    contact_id: uuid.UUID
    relationship_type: str = "related"


class MatterContactResponse(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    relationship_type: str
    contact_first_name: str | None = None
    contact_last_name: str | None = None


class MatterResponse(BaseModel):
    id: uuid.UUID
    matter_number: int
    title: str
    client_id: uuid.UUID
    status: MatterStatus
    litigation_type: LitigationType
    jurisdiction: str | None
    court_name: str | None
    case_number: str | None
    date_opened: date
    date_closed: date | None
    description: str | None
    assigned_attorney_id: uuid.UUID | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
