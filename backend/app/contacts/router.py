import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.contacts.models import ContactRole
from app.contacts.schemas import ContactCreate, ContactResponse, ContactUpdate
from app.contacts.service import create_contact, delete_contact, get_contact, get_contacts, update_contact
from app.database import get_db
from app.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_contacts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    role: Optional[ContactRole] = None,
):
    contacts, total = await get_contacts(db, page, page_size, search, role)
    items = [ContactResponse.model_validate(c).model_dump() for c in contacts]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact_detail(
    contact_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    contact = await get_contact(db, contact_id)
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_new_contact(
    data: ContactCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    contact = await create_contact(db, data)
    await create_audit_log(
        db,
        current_user.id,
        "contact",
        str(contact.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return contact


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_existing_contact(
    contact_id: uuid.UUID,
    data: ContactUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    contact = await get_contact(db, contact_id)
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    updated = await update_contact(db, contact, data)
    await create_audit_log(
        db,
        current_user.id,
        "contact",
        str(contact_id),
        "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return updated


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_contact(
    contact_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    contact = await get_contact(db, contact_id)
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")

    await delete_contact(db, contact)
    await create_audit_log(
        db,
        current_user.id,
        "contact",
        str(contact_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )
