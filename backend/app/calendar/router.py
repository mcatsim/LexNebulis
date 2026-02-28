import json
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.calendar.models import EventStatus, EventType
from app.calendar.schemas import CalendarEventCreate, CalendarEventResponse, CalendarEventUpdate
from app.calendar.service import check_conflicts, create_event, delete_event, get_event, get_events, update_event
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 50,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    matter_id: uuid.UUID | None = None,
    assigned_to: uuid.UUID | None = None,
    event_type: EventType | None = None,
    event_status: EventStatus | None = None,
):
    events, total = await get_events(db, page, page_size, start_date, end_date, matter_id, assigned_to, event_type, event_status)
    items = [CalendarEventResponse.model_validate(e).model_dump() for e in events]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{event_id}", response_model=CalendarEventResponse)
async def get_event_detail(
    event_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    event = await get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.post("", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_new_event(
    data: CalendarEventCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    # Check for conflicts
    if data.assigned_to and data.end_datetime:
        conflicts = await check_conflicts(db, data.assigned_to, data.start_datetime, data.end_datetime)
        if conflicts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Schedule conflict with {len(conflicts)} existing event(s)",
            )

    event = await create_event(db, data, current_user.id)
    await create_audit_log(
        db, current_user.id, "calendar_event", str(event.id), "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return event


@router.put("/{event_id}", response_model=CalendarEventResponse)
async def update_existing_event(
    event_id: uuid.UUID,
    data: CalendarEventUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    event = await get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Check conflicts if time changed
    assigned = data.assigned_to or event.assigned_to
    start = data.start_datetime or event.start_datetime
    end = data.end_datetime or event.end_datetime
    if assigned and end:
        conflicts = await check_conflicts(db, assigned, start, end, exclude_id=event_id)
        if conflicts:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Schedule conflict with {len(conflicts)} existing event(s)",
            )

    updated = await update_event(db, event, data)
    await create_audit_log(
        db, current_user.id, "calendar_event", str(event_id), "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return updated


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_event(
    event_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    event = await get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    await delete_event(db, event)
    await create_audit_log(
        db, current_user.id, "calendar_event", str(event_id), "delete",
        ip_address=request.client.host if request.client else None,
    )
