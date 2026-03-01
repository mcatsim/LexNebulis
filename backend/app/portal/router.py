import json
import uuid as _uuid
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.matters.models import Matter
from app.portal.models import ClientUser, SenderType
from app.portal.schemas import (
    ClientLoginRequest,
    ClientLoginResponse,
    ClientUserCreate,
    ClientUserResponse,
    ClientUserUpdate,
    MessageCreate,
    MessageResponse,
    PortalMatterResponse,
    SharedDocumentResponse,
    ShareDocumentRequest,
    UnreadCountResponse,
)
from app.portal.service import (
    authenticate_client_user,
    create_client_access_token,
    create_client_refresh_token_value,
    create_client_user,
    get_client_invoices,
    get_client_matter_detail,
    get_client_matters,
    get_client_user_by_id,
    get_client_users_for_client,
    get_messages,
    get_shared_documents,
    get_shared_documents_staff,
    get_unread_count,
    mark_message_read,
    send_message,
    share_document,
)

portal_security = HTTPBearer()


# ── Client JWT dependency ─────────────────────────────────────────────


async def get_current_client_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(portal_security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ClientUser:
    """Validate a client portal JWT and return the ClientUser.

    Client tokens use type='client_access' to distinguish from staff tokens.
    """
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if user_id is None or token_type != "client_access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid client token",
            )
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client token",
        )

    result = await db.execute(select(ClientUser).where(ClientUser.id == _uuid.UUID(user_id)))
    client_user = result.scalar_one_or_none()

    if client_user is None or not client_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Client user not found or inactive",
        )

    return client_user


# ══════════════════════════════════════════════════════════════════════
# STAFF-FACING ROUTER
# ══════════════════════════════════════════════════════════════════════

staff_router = APIRouter()


# ── Client User Management ────────────────────────────────────────────


@staff_router.post(
    "/client-users",
    response_model=ClientUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def staff_create_client_user(
    data: ClientUserCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    """Create a client portal login account (admin/attorney only)."""
    # Check for existing email
    existing = await db.execute(select(ClientUser).where(ClientUser.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered for a client user",
        )

    client_user = await create_client_user(db, data)

    await create_audit_log(
        db,
        current_user.id,
        "client_user",
        str(client_user.id),
        "create",
        changes_json=json.dumps({"email": data.email, "client_id": str(data.client_id)}),
        ip_address=request.client.host if request.client else None,
        user_email=current_user.email,
    )

    return client_user


@staff_router.get("/client-users/{client_id}", response_model=list[ClientUserResponse])
async def staff_list_client_users(
    client_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """List all client portal users for a given client."""
    users = await get_client_users_for_client(db, _uuid.UUID(client_id))
    return users


@staff_router.put("/client-users/{user_id}", response_model=ClientUserResponse)
async def staff_update_client_user(
    user_id: str,
    data: ClientUserUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    """Update a client portal user (activate/deactivate, name changes)."""
    client_user = await get_client_user_by_id(db, _uuid.UUID(user_id))
    if client_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client user not found",
        )

    changes = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        old_value = getattr(client_user, field)
        if value is not None and value != old_value:
            changes[field] = {"old": str(old_value), "new": str(value)}
            setattr(client_user, field, value)

    if changes:
        await create_audit_log(
            db,
            current_user.id,
            "client_user",
            str(client_user.id),
            "update",
            changes_json=json.dumps(changes),
            ip_address=request.client.host if request.client else None,
            user_email=current_user.email,
        )

    await db.flush()
    await db.refresh(client_user)
    return client_user


# ── Shared Documents (Staff) ─────────────────────────────────────────


@staff_router.post("/share-document", response_model=SharedDocumentResponse)
async def staff_share_document(
    data: ShareDocumentRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Share a document with the client portal."""
    shared_doc = await share_document(db, data.document_id, data.matter_id, current_user.id, data.note)

    await create_audit_log(
        db,
        current_user.id,
        "shared_document",
        str(shared_doc.id),
        "create",
        changes_json=json.dumps(
            {
                "document_id": str(data.document_id),
                "matter_id": str(data.matter_id),
            }
        ),
        ip_address=request.client.host if request.client else None,
        user_email=current_user.email,
    )

    # Build response
    doc = shared_doc.document
    return SharedDocumentResponse(
        id=shared_doc.id,
        document_id=shared_doc.document_id,
        matter_id=shared_doc.matter_id,
        filename=doc.filename if doc else "Unknown",
        mime_type=doc.mime_type if doc else "unknown",
        size_bytes=doc.size_bytes if doc else 0,
        shared_by_name=f"{current_user.first_name} {current_user.last_name}",
        shared_at=shared_doc.shared_at,
        note=shared_doc.note,
    )


@staff_router.get("/shared-documents/{matter_id}", response_model=PaginatedResponse)
async def staff_list_shared_documents(
    matter_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
):
    """List shared documents for a matter (staff view)."""
    items, total = await get_shared_documents_staff(db, _uuid.UUID(matter_id), page, page_size)
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


# ── Messages (Staff) ─────────────────────────────────────────────────


@staff_router.get("/messages/{matter_id}", response_model=PaginatedResponse)
async def staff_get_messages(
    matter_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
):
    """View messages for a matter."""
    items, total = await get_messages(db, _uuid.UUID(matter_id), page, page_size)
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@staff_router.post("/messages", response_model=MessageResponse)
async def staff_send_message(
    data: MessageCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Send a message as staff."""
    msg = await send_message(
        db,
        data.matter_id,
        SenderType.staff,
        current_user.id,
        data.body,
        data.subject,
        data.parent_message_id,
    )

    await create_audit_log(
        db,
        current_user.id,
        "message",
        str(msg.id),
        "create",
        changes_json=json.dumps({"matter_id": str(data.matter_id)}),
        ip_address=request.client.host if request.client else None,
        user_email=current_user.email,
    )

    sender_name = f"{current_user.first_name} {current_user.last_name}"
    return MessageResponse(
        id=msg.id,
        matter_id=msg.matter_id,
        sender_type=msg.sender_type.value,
        sender_name=sender_name,
        subject=msg.subject,
        body=msg.body,
        parent_message_id=msg.parent_message_id,
        is_read=msg.is_read,
        read_at=msg.read_at,
        created_at=msg.created_at,
    )


# ══════════════════════════════════════════════════════════════════════
# CLIENT-FACING ROUTER
# ══════════════════════════════════════════════════════════════════════

client_router = APIRouter()


# ── Client Auth ───────────────────────────────────────────────────────


@client_router.post("/auth/login", response_model=ClientLoginResponse)
async def client_login(
    data: ClientLoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Client portal login endpoint."""
    client_user = await authenticate_client_user(db, data.email, data.password)
    if client_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    access_token = create_client_access_token(str(client_user.id))
    refresh_token = create_client_refresh_token_value()

    await create_audit_log(
        db,
        None,
        "client_user",
        str(client_user.id),
        "login",
        ip_address=request.client.host if request.client else None,
        user_email=client_user.email,
    )

    return ClientLoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@client_router.get("/auth/me", response_model=ClientUserResponse)
async def client_get_me(
    client_user: Annotated[ClientUser, Depends(get_current_client_user)],
):
    """Get the current client user's profile."""
    return client_user


# ── Client Matters ────────────────────────────────────────────────────


@client_router.get("/my/matters", response_model=PaginatedResponse)
async def client_list_matters(
    client_user: Annotated[ClientUser, Depends(get_current_client_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    page_size: int = 25,
):
    """List matters belonging to the client."""
    items, total = await get_client_matters(db, client_user.client_id, page, page_size)
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@client_router.get("/my/matters/{matter_id}", response_model=PortalMatterResponse)
async def client_get_matter(
    matter_id: str,
    client_user: Annotated[ClientUser, Depends(get_current_client_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a specific matter detail (only if it belongs to the client)."""
    detail = await get_client_matter_detail(db, client_user.client_id, _uuid.UUID(matter_id))
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matter not found",
        )
    return detail


# ── Client Documents ──────────────────────────────────────────────────


@client_router.get("/my/matters/{matter_id}/documents", response_model=PaginatedResponse)
async def client_get_documents(
    matter_id: str,
    client_user: Annotated[ClientUser, Depends(get_current_client_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    page_size: int = 25,
):
    """Get shared documents for a specific matter."""
    items, total = await get_shared_documents(db, _uuid.UUID(matter_id), client_user.client_id, page, page_size)
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


# ── Client Invoices ───────────────────────────────────────────────────


@client_router.get("/my/invoices", response_model=PaginatedResponse)
async def client_list_invoices(
    client_user: Annotated[ClientUser, Depends(get_current_client_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    page_size: int = 25,
):
    """List invoices for the client."""
    items, total = await get_client_invoices(db, client_user.client_id, page, page_size)
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


# ── Client Messages ───────────────────────────────────────────────────


@client_router.get("/my/matters/{matter_id}/messages", response_model=PaginatedResponse)
async def client_get_messages(
    matter_id: str,
    client_user: Annotated[ClientUser, Depends(get_current_client_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = 1,
    page_size: int = 25,
):
    """Get messages for a matter (verifies client ownership)."""
    # Verify client owns this matter
    matter_check = await db.execute(
        select(Matter).where(
            Matter.id == _uuid.UUID(matter_id),
            Matter.client_id == client_user.client_id,
        )
    )
    if matter_check.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matter not found",
        )

    items, total = await get_messages(db, _uuid.UUID(matter_id), page, page_size)
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@client_router.post("/my/messages", response_model=MessageResponse)
async def client_send_message(
    data: MessageCreate,
    request: Request,
    client_user: Annotated[ClientUser, Depends(get_current_client_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Send a message as a client user."""
    # Verify client owns the matter
    matter_check = await db.execute(
        select(Matter).where(
            Matter.id == data.matter_id,
            Matter.client_id == client_user.client_id,
        )
    )
    if matter_check.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matter not found",
        )

    msg = await send_message(
        db,
        data.matter_id,
        SenderType.client,
        client_user.id,
        data.body,
        data.subject,
        data.parent_message_id,
    )

    await create_audit_log(
        db,
        None,
        "message",
        str(msg.id),
        "create",
        changes_json=json.dumps(
            {
                "matter_id": str(data.matter_id),
                "sender_client_user_id": str(client_user.id),
            }
        ),
        ip_address=request.client.host if request.client else None,
        user_email=client_user.email,
    )

    sender_name = f"{client_user.first_name} {client_user.last_name}"
    return MessageResponse(
        id=msg.id,
        matter_id=msg.matter_id,
        sender_type=msg.sender_type.value,
        sender_name=sender_name,
        subject=msg.subject,
        body=msg.body,
        parent_message_id=msg.parent_message_id,
        is_read=msg.is_read,
        read_at=msg.read_at,
        created_at=msg.created_at,
    )


@client_router.put("/my/messages/{message_id}/read", response_model=MessageResponse)
async def client_mark_message_read(
    message_id: str,
    client_user: Annotated[ClientUser, Depends(get_current_client_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Mark a message as read."""
    msg = await mark_message_read(db, _uuid.UUID(message_id))
    if msg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )

    # Verify the message belongs to a matter owned by this client
    matter_check = await db.execute(
        select(Matter).where(
            Matter.id == msg.matter_id,
            Matter.client_id == client_user.client_id,
        )
    )
    if matter_check.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )

    # Build sender name
    if msg.sender_type == SenderType.staff and msg.sender_staff:
        sender_name = f"{msg.sender_staff.first_name} {msg.sender_staff.last_name}"
    elif msg.sender_type == SenderType.client and msg.sender_client_user:
        sender_name = f"{msg.sender_client_user.first_name} {msg.sender_client_user.last_name}"
    else:
        sender_name = "Unknown"

    return MessageResponse(
        id=msg.id,
        matter_id=msg.matter_id,
        sender_type=msg.sender_type.value,
        sender_name=sender_name,
        subject=msg.subject,
        body=msg.body,
        parent_message_id=msg.parent_message_id,
        is_read=msg.is_read,
        read_at=msg.read_at,
        created_at=msg.created_at,
    )


@client_router.get("/my/unread", response_model=UnreadCountResponse)
async def client_get_unread_count(
    client_user: Annotated[ClientUser, Depends(get_current_client_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the count of unread messages for the client."""
    count = await get_unread_count(db, client_user.client_id)
    return UnreadCountResponse(unread_count=count)
