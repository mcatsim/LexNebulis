import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.calendar.models import EventStatus, EventType


class CalendarEventCreate(BaseModel):
    matter_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    event_type: EventType = EventType.meeting
    start_datetime: datetime
    end_datetime: datetime | None = None
    all_day: bool = False
    location: str | None = Field(default=None, max_length=500)
    assigned_to: uuid.UUID | None = None
    reminder_minutes: int | None = None
    status: EventStatus = EventStatus.scheduled


class CalendarEventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    event_type: EventType | None = None
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    all_day: bool | None = None
    location: str | None = Field(default=None, max_length=500)
    assigned_to: uuid.UUID | None = None
    reminder_minutes: int | None = None
    status: EventStatus | None = None


class CalendarEventResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID | None
    title: str
    description: str | None
    event_type: EventType
    start_datetime: datetime
    end_datetime: datetime | None
    all_day: bool
    location: str | None
    assigned_to: uuid.UUID | None
    reminder_minutes: int | None
    status: EventStatus
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
