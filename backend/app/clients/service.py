import uuid
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.models import Client, ClientStatus
from app.clients.schemas import ClientCreate, ClientUpdate


async def get_clients(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    status: Optional[ClientStatus] = None,
) -> tuple[list[Client], int]:
    query = select(Client)
    count_query = select(func.count(Client.id))

    if search:
        search_filter = or_(
            Client.first_name.ilike(f"%{search}%"),
            Client.last_name.ilike(f"%{search}%"),
            Client.organization_name.ilike(f"%{search}%"),
            Client.email.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if status:
        query = query.where(Client.status == status)
        count_query = count_query.where(Client.status == status)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(Client.client_number.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_client(db: AsyncSession, client_id: uuid.UUID) -> Optional[Client]:
    result = await db.execute(select(Client).where(Client.id == client_id))
    return result.scalar_one_or_none()


async def create_client(db: AsyncSession, data: ClientCreate, created_by: uuid.UUID) -> Client:
    client = Client(**data.model_dump(), created_by=created_by)
    db.add(client)
    await db.flush()

    # Auto-assign client_number (max + 1, starting from 1001)
    max_num = await db.execute(select(func.coalesce(func.max(Client.client_number), 1000)))
    client.client_number = max_num.scalar() + 1
    await db.flush()

    await db.refresh(client)
    return client


async def update_client(db: AsyncSession, client: Client, data: ClientUpdate) -> Client:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    await db.flush()
    await db.refresh(client)
    return client


async def delete_client(db: AsyncSession, client: Client) -> None:
    await db.delete(client)
    await db.flush()
