import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.calendar.models import EventStatus, EventType


class CalendarEventCreate(BaseModel):
    matter_id: Optional[uuid.UUID] = None
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    event_type: EventType = EventType.meeting
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    all_day: bool = False
    location: Optional[str] = Field(default=None, max_length=500)
    assigned_to: Optional[uuid.UUID] = None
    reminder_minutes: Optional[int] = None
    status: EventStatus = EventStatus.scheduled


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    event_type: Optional[EventType] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = Field(default=None, max_length=500)
    assigned_to: Optional[uuid.UUID] = None
    reminder_minutes: Optional[int] = None
    status: Optional[EventStatus] = None


class CalendarEventResponse(BaseModel):
    id: uuid.UUID
    matter_id: Optional[uuid.UUID]
    title: str
    description: Optional[str]
    event_type: EventType
    start_datetime: datetime
    end_datetime: Optional[datetime]
    all_day: bool
    location: Optional[str]
    assigned_to: Optional[uuid.UUID]
    reminder_minutes: Optional[int]
    status: EventStatus
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
