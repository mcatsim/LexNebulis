import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.matters.models import LitigationType, MatterStatus


class MatterCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    client_id: uuid.UUID
    status: MatterStatus = MatterStatus.open
    litigation_type: LitigationType = LitigationType.other
    jurisdiction: Optional[str] = Field(default=None, max_length=255)
    court_name: Optional[str] = Field(default=None, max_length=255)
    case_number: Optional[str] = Field(default=None, max_length=100)
    date_opened: Optional[date] = None
    description: Optional[str] = None
    assigned_attorney_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class MatterUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    status: Optional[MatterStatus] = None
    litigation_type: Optional[LitigationType] = None
    jurisdiction: Optional[str] = Field(default=None, max_length=255)
    court_name: Optional[str] = Field(default=None, max_length=255)
    case_number: Optional[str] = Field(default=None, max_length=100)
    date_closed: Optional[date] = None
    description: Optional[str] = None
    assigned_attorney_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class MatterContactAdd(BaseModel):
    contact_id: uuid.UUID
    relationship_type: str = "related"


class MatterContactResponse(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    relationship_type: str
    contact_first_name: Optional[str] = None
    contact_last_name: Optional[str] = None


class MatterResponse(BaseModel):
    id: uuid.UUID
    matter_number: int
    title: str
    client_id: uuid.UUID
    status: MatterStatus
    litigation_type: LitigationType
    jurisdiction: Optional[str]
    court_name: Optional[str]
    case_number: Optional[str]
    date_opened: date
    date_closed: Optional[date]
    description: Optional[str]
    assigned_attorney_id: Optional[uuid.UUID]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
