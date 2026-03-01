import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.models import Invoice
from app.config import settings
from app.matters.models import Matter
from app.portal.models import ClientUser, Message, SenderType, SharedDocument
from app.portal.schemas import ClientUserCreate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_client_access_token(client_user_id: str) -> str:
    """Create a JWT with type 'client_access' to distinguish from staff tokens."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": client_user_id, "type": "client_access", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_client_refresh_token_value() -> str:
    return str(uuid.uuid4())


# ── Authentication ────────────────────────────────────────────────────


async def authenticate_client_user(db: AsyncSession, email: str, password: str) -> Optional[ClientUser]:
    """Authenticate a client portal user by email and password."""
    result = await db.execute(select(ClientUser).where(ClientUser.email == email))
    client_user = result.scalar_one_or_none()
    if client_user is None:
        return None
    if not client_user.is_active:
        return None
    if not verify_password(password, client_user.password_hash):
        return None

    # Update last_login
    client_user.last_login = datetime.now(timezone.utc)
    await db.flush()
    return client_user


# ── Client User CRUD ─────────────────────────────────────────────────


async def create_client_user(db: AsyncSession, data: ClientUserCreate) -> ClientUser:
    """Create a new client portal login account."""
    client_user = ClientUser(
        client_id=data.client_id,
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
    )
    db.add(client_user)
    await db.flush()
    await db.refresh(client_user)
    return client_user


async def get_client_users_for_client(db: AsyncSession, client_id: uuid.UUID) -> list[ClientUser]:
    """List all portal user accounts for a given client."""
    result = await db.execute(
        select(ClientUser).where(ClientUser.client_id == client_id).order_by(ClientUser.created_at.desc())
    )
    return list(result.scalars().all())


async def get_client_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[ClientUser]:
    result = await db.execute(select(ClientUser).where(ClientUser.id == user_id))
    return result.scalar_one_or_none()


# ── Matters ───────────────────────────────────────────────────────────


async def get_client_matters(
    db: AsyncSession, client_id: uuid.UUID, page: int = 1, page_size: int = 25
) -> tuple[list[dict], int]:
    """Get matters belonging to a client with pagination."""
    offset = (page - 1) * page_size

    count_result = await db.execute(select(func.count(Matter.id)).where(Matter.client_id == client_id))
    total = count_result.scalar_one()

    result = await db.execute(
        select(Matter)
        .where(Matter.client_id == client_id)
        .order_by(Matter.date_opened.desc())
        .offset(offset)
        .limit(page_size)
    )
    matters = result.scalars().all()

    items = []
    for m in matters:
        attorney_name = None
        if m.assigned_attorney:
            attorney_name = f"{m.assigned_attorney.first_name} {m.assigned_attorney.last_name}"
        items.append(
            {
                "id": str(m.id),
                "title": m.title,
                "status": m.status.value,
                "litigation_type": m.litigation_type.value,
                "date_opened": str(m.date_opened),
                "date_closed": str(m.date_closed) if m.date_closed else None,
                "description": m.description,
                "attorney_name": attorney_name,
            }
        )

    return items, total


async def get_client_matter_detail(db: AsyncSession, client_id: uuid.UUID, matter_id: uuid.UUID) -> Optional[dict]:
    """Get a single matter detail, verifying the client owns it."""
    result = await db.execute(select(Matter).where(Matter.id == matter_id, Matter.client_id == client_id))
    m = result.scalar_one_or_none()
    if m is None:
        return None

    attorney_name = None
    if m.assigned_attorney:
        attorney_name = f"{m.assigned_attorney.first_name} {m.assigned_attorney.last_name}"

    return {
        "id": str(m.id),
        "title": m.title,
        "status": m.status.value,
        "litigation_type": m.litigation_type.value,
        "date_opened": str(m.date_opened),
        "date_closed": str(m.date_closed) if m.date_closed else None,
        "description": m.description,
        "attorney_name": attorney_name,
    }


# ── Shared Documents ─────────────────────────────────────────────────


async def get_shared_documents(
    db: AsyncSession,
    matter_id: uuid.UUID,
    client_id: uuid.UUID,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict], int]:
    """Get documents shared with the client portal for a given matter."""
    # Verify the matter belongs to this client
    matter_check = await db.execute(select(Matter.id).where(Matter.id == matter_id, Matter.client_id == client_id))
    if matter_check.scalar_one_or_none() is None:
        return [], 0

    offset = (page - 1) * page_size

    count_result = await db.execute(select(func.count(SharedDocument.id)).where(SharedDocument.matter_id == matter_id))
    total = count_result.scalar_one()

    result = await db.execute(
        select(SharedDocument)
        .where(SharedDocument.matter_id == matter_id)
        .order_by(SharedDocument.shared_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    shared_docs = result.scalars().all()

    items = []
    for sd in shared_docs:
        doc = sd.document
        shared_by_user = sd.shared_by_user
        items.append(
            {
                "id": str(sd.id),
                "document_id": str(sd.document_id),
                "matter_id": str(sd.matter_id),
                "filename": doc.filename if doc else "Unknown",
                "mime_type": doc.mime_type if doc else "unknown",
                "size_bytes": doc.size_bytes if doc else 0,
                "shared_by_name": f"{shared_by_user.first_name} {shared_by_user.last_name}"
                if shared_by_user
                else "Unknown",
                "shared_at": sd.shared_at.isoformat(),
                "note": sd.note,
            }
        )

    return items, total


async def share_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    matter_id: uuid.UUID,
    shared_by: uuid.UUID,
    note: Optional[str] = None,
) -> SharedDocument:
    """Share a document with the client portal."""
    shared_doc = SharedDocument(
        document_id=document_id,
        matter_id=matter_id,
        shared_by=shared_by,
        note=note,
    )
    db.add(shared_doc)
    await db.flush()
    await db.refresh(shared_doc)
    return shared_doc


async def get_shared_documents_staff(
    db: AsyncSession,
    matter_id: uuid.UUID,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict], int]:
    """Get shared documents for a matter (staff view, no client ownership check)."""
    offset = (page - 1) * page_size

    count_result = await db.execute(select(func.count(SharedDocument.id)).where(SharedDocument.matter_id == matter_id))
    total = count_result.scalar_one()

    result = await db.execute(
        select(SharedDocument)
        .where(SharedDocument.matter_id == matter_id)
        .order_by(SharedDocument.shared_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    shared_docs = result.scalars().all()

    items = []
    for sd in shared_docs:
        doc = sd.document
        shared_by_user = sd.shared_by_user
        items.append(
            {
                "id": str(sd.id),
                "document_id": str(sd.document_id),
                "matter_id": str(sd.matter_id),
                "filename": doc.filename if doc else "Unknown",
                "mime_type": doc.mime_type if doc else "unknown",
                "size_bytes": doc.size_bytes if doc else 0,
                "shared_by_name": f"{shared_by_user.first_name} {shared_by_user.last_name}"
                if shared_by_user
                else "Unknown",
                "shared_at": sd.shared_at.isoformat(),
                "note": sd.note,
            }
        )

    return items, total


# ── Invoices ──────────────────────────────────────────────────────────


async def get_client_invoices(
    db: AsyncSession, client_id: uuid.UUID, page: int = 1, page_size: int = 25
) -> tuple[list[dict], int]:
    """Get invoices for a client (only non-draft invoices visible to clients)."""
    offset = (page - 1) * page_size

    count_result = await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.client_id == client_id,
            Invoice.status != "draft",
        )
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Invoice)
        .where(Invoice.client_id == client_id, Invoice.status != "draft")
        .order_by(Invoice.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    invoices = result.scalars().all()

    items = []
    for inv in invoices:
        matter_title = inv.matter.title if inv.matter else None
        items.append(
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "matter_title": matter_title,
                "total_cents": inv.total_cents,
                "status": inv.status.value,
                "issued_date": str(inv.issued_date) if inv.issued_date else None,
                "due_date": str(inv.due_date) if inv.due_date else None,
            }
        )

    return items, total


# ── Messages ──────────────────────────────────────────────────────────


async def get_messages(
    db: AsyncSession, matter_id: uuid.UUID, page: int = 1, page_size: int = 25
) -> tuple[list[dict], int]:
    """Get messages for a matter with pagination."""
    offset = (page - 1) * page_size

    count_result = await db.execute(select(func.count(Message.id)).where(Message.matter_id == matter_id))
    total = count_result.scalar_one()

    result = await db.execute(
        select(Message)
        .where(Message.matter_id == matter_id)
        .order_by(Message.created_at.asc())
        .offset(offset)
        .limit(page_size)
    )
    messages = result.scalars().all()

    items = []
    for msg in messages:
        if msg.sender_type == SenderType.staff and msg.sender_staff:
            sender_name = f"{msg.sender_staff.first_name} {msg.sender_staff.last_name}"
        elif msg.sender_type == SenderType.client and msg.sender_client_user:
            sender_name = f"{msg.sender_client_user.first_name} {msg.sender_client_user.last_name}"
        else:
            sender_name = "Unknown"

        items.append(
            {
                "id": str(msg.id),
                "matter_id": str(msg.matter_id),
                "sender_type": msg.sender_type.value,
                "sender_name": sender_name,
                "subject": msg.subject,
                "body": msg.body,
                "parent_message_id": str(msg.parent_message_id) if msg.parent_message_id else None,
                "is_read": msg.is_read,
                "read_at": msg.read_at.isoformat() if msg.read_at else None,
                "created_at": msg.created_at.isoformat(),
            }
        )

    return items, total


async def send_message(
    db: AsyncSession,
    matter_id: uuid.UUID,
    sender_type: SenderType,
    sender_id: uuid.UUID,
    body: str,
    subject: Optional[str] = None,
    parent_id: Optional[uuid.UUID] = None,
) -> Message:
    """Send a message in a matter thread."""
    msg = Message(
        matter_id=matter_id,
        sender_type=sender_type,
        body=body,
        subject=subject,
        parent_message_id=parent_id,
    )
    if sender_type == SenderType.staff:
        msg.sender_staff_id = sender_id
    else:
        msg.sender_client_user_id = sender_id

    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    return msg


async def mark_message_read(db: AsyncSession, message_id: uuid.UUID) -> Optional[Message]:
    """Mark a message as read."""
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if msg is None:
        return None

    msg.is_read = True
    msg.read_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(msg)
    return msg


async def get_unread_count(db: AsyncSession, client_id: uuid.UUID) -> int:
    """Get the count of unread messages for a client across all their matters."""
    # Get all matter IDs for this client
    matters_result = await db.execute(select(Matter.id).where(Matter.client_id == client_id))
    matter_ids = [row[0] for row in matters_result.all()]

    if not matter_ids:
        return 0

    count_result = await db.execute(
        select(func.count(Message.id)).where(
            Message.matter_id.in_(matter_ids),
            Message.sender_type == SenderType.staff,
            Message.is_read == False,  # noqa: E712
        )
    )
    return count_result.scalar_one()
