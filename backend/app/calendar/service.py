import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.calendar.models import CalendarEvent, EventStatus, EventType
from app.calendar.schemas import CalendarEventCreate, CalendarEventUpdate


async def get_events(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    matter_id: Optional[uuid.UUID] = None,
    assigned_to: Optional[uuid.UUID] = None,
    event_type: Optional[EventType] = None,
    status: Optional[EventStatus] = None,
) -> tuple[list[CalendarEvent], int]:
    query = select(CalendarEvent)
    count_query = select(func.count(CalendarEvent.id))

    if start_date:
        query = query.where(CalendarEvent.start_datetime >= start_date)
        count_query = count_query.where(CalendarEvent.start_datetime >= start_date)
    if end_date:
        query = query.where(CalendarEvent.start_datetime <= end_date)
        count_query = count_query.where(CalendarEvent.start_datetime <= end_date)
    if matter_id:
        query = query.where(CalendarEvent.matter_id == matter_id)
        count_query = count_query.where(CalendarEvent.matter_id == matter_id)
    if assigned_to:
        query = query.where(CalendarEvent.assigned_to == assigned_to)
        count_query = count_query.where(CalendarEvent.assigned_to == assigned_to)
    if event_type:
        query = query.where(CalendarEvent.event_type == event_type)
        count_query = count_query.where(CalendarEvent.event_type == event_type)
    if status:
        query = query.where(CalendarEvent.status == status)
        count_query = count_query.where(CalendarEvent.status == status)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(CalendarEvent.start_datetime.asc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_event(db: AsyncSession, event_id: uuid.UUID) -> Optional[CalendarEvent]:
    result = await db.execute(select(CalendarEvent).where(CalendarEvent.id == event_id))
    return result.scalar_one_or_none()


async def check_conflicts(
    db: AsyncSession,
    assigned_to: uuid.UUID,
    start: datetime,
    end: Optional[datetime],
    exclude_id: Optional[uuid.UUID] = None,
) -> list[CalendarEvent]:
    if end is None:
        return []
    query = select(CalendarEvent).where(
        and_(
            CalendarEvent.assigned_to == assigned_to,
            CalendarEvent.status == EventStatus.scheduled,
            CalendarEvent.end_datetime.isnot(None),
            or_(
                and_(CalendarEvent.start_datetime < end, CalendarEvent.end_datetime > start),
            ),
        )
    )
    if exclude_id:
        query = query.where(CalendarEvent.id != exclude_id)
    result = await db.execute(query)
    return result.scalars().all()


async def create_event(db: AsyncSession, data: CalendarEventCreate, created_by: uuid.UUID) -> CalendarEvent:
    event = CalendarEvent(**data.model_dump(), created_by=created_by)
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def update_event(db: AsyncSession, event: CalendarEvent, data: CalendarEventUpdate) -> CalendarEvent:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    await db.flush()
    await db.refresh(event)
    return event


async def delete_event(db: AsyncSession, event: CalendarEvent) -> None:
    await db.delete(event)
    await db.flush()
