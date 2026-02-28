import uuid
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.contacts.models import Contact, ContactRole
from app.contacts.schemas import ContactCreate, ContactUpdate


async def get_contacts(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    role: Optional[ContactRole] = None,
) -> tuple[list[Contact], int]:
    query = select(Contact)
    count_query = select(func.count(Contact.id))

    if search:
        search_filter = or_(
            Contact.first_name.ilike(f"%{search}%"),
            Contact.last_name.ilike(f"%{search}%"),
            Contact.organization.ilike(f"%{search}%"),
            Contact.email.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if role:
        query = query.where(Contact.role == role)
        count_query = count_query.where(Contact.role == role)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(Contact.last_name, Contact.first_name).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_contact(db: AsyncSession, contact_id: uuid.UUID) -> Optional[Contact]:
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    return result.scalar_one_or_none()


async def create_contact(db: AsyncSession, data: ContactCreate) -> Contact:
    contact = Contact(**data.model_dump())
    db.add(contact)
    await db.flush()
    await db.refresh(contact)
    return contact


async def update_contact(db: AsyncSession, contact: Contact, data: ContactUpdate) -> Contact:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    await db.flush()
    await db.refresh(contact)
    return contact


async def delete_contact(db: AsyncSession, contact: Contact) -> None:
    await db.delete(contact)
    await db.flush()
