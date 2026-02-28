import uuid
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.matters.models import LitigationType, Matter, MatterContact, MatterStatus
from app.matters.schemas import MatterCreate, MatterUpdate


async def get_matters(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    status: Optional[MatterStatus] = None,
    client_id: Optional[uuid.UUID] = None,
    attorney_id: Optional[uuid.UUID] = None,
    litigation_type: Optional[LitigationType] = None,
) -> tuple[list[Matter], int]:
    query = select(Matter)
    count_query = select(func.count(Matter.id))

    if search:
        search_filter = or_(
            Matter.title.ilike(f"%{search}%"),
            Matter.case_number.ilike(f"%{search}%"),
            Matter.description.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if status:
        query = query.where(Matter.status == status)
        count_query = count_query.where(Matter.status == status)

    if client_id:
        query = query.where(Matter.client_id == client_id)
        count_query = count_query.where(Matter.client_id == client_id)

    if attorney_id:
        query = query.where(Matter.assigned_attorney_id == attorney_id)
        count_query = count_query.where(Matter.assigned_attorney_id == attorney_id)

    if litigation_type:
        query = query.where(Matter.litigation_type == litigation_type)
        count_query = count_query.where(Matter.litigation_type == litigation_type)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(Matter.matter_number.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_matter(db: AsyncSession, matter_id: uuid.UUID) -> Optional[Matter]:
    result = await db.execute(select(Matter).where(Matter.id == matter_id))
    return result.scalar_one_or_none()


async def create_matter(db: AsyncSession, data: MatterCreate) -> Matter:
    matter_data = data.model_dump()
    if matter_data.get("date_opened") is None:
        matter_data.pop("date_opened", None)
    matter = Matter(**matter_data)
    db.add(matter)
    await db.flush()

    # Auto-assign matter_number (max + 1, starting from 10001)
    max_num = await db.execute(select(func.coalesce(func.max(Matter.matter_number), 10000)))
    matter.matter_number = max_num.scalar() + 1
    await db.flush()

    await db.refresh(matter)
    return matter


async def update_matter(db: AsyncSession, matter: Matter, data: MatterUpdate) -> Matter:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(matter, field, value)
    await db.flush()
    await db.refresh(matter)
    return matter


async def delete_matter(db: AsyncSession, matter: Matter) -> None:
    await db.delete(matter)
    await db.flush()


async def add_matter_contact(db: AsyncSession, matter_id: uuid.UUID, contact_id: uuid.UUID, relationship_type: str) -> MatterContact:
    mc = MatterContact(matter_id=matter_id, contact_id=contact_id, relationship_type=relationship_type)
    db.add(mc)
    await db.flush()
    return mc


async def remove_matter_contact(db: AsyncSession, matter_contact_id: uuid.UUID) -> None:
    result = await db.execute(select(MatterContact).where(MatterContact.id == matter_contact_id))
    mc = result.scalar_one_or_none()
    if mc:
        await db.delete(mc)
        await db.flush()
