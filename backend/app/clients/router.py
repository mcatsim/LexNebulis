import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.clients.models import ClientStatus
from app.clients.schemas import ClientCreate, ClientResponse, ClientUpdate
from app.clients.service import create_client, delete_client, get_client, get_clients, update_client
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_clients(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    status: Optional[ClientStatus] = None,
):
    clients, total = await get_clients(db, page, page_size, search, status)
    items = [ClientResponse.model_validate(c).model_dump() for c in clients]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client_detail(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    client = await get_client(db, client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_new_client(
    data: ClientCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    client = await create_client(db, data, current_user.id)
    await create_audit_log(
        db, current_user.id, "client", str(client.id), "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return client


@router.put("/{client_id}", response_model=ClientResponse)
async def update_existing_client(
    client_id: uuid.UUID,
    data: ClientUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    client = await get_client(db, client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    updated = await update_client(db, client, data)
    await create_audit_log(
        db, current_user.id, "client", str(client_id), "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return updated


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_client(
    client_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    client = await get_client(db, client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    await delete_client(db, client)
    await create_audit_log(
        db, current_user.id, "client", str(client_id), "delete",
        ip_address=request.client.host if request.client else None,
    )
