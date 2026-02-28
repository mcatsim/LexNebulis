import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.emails.models import EmailAttachment, EmailDirection, EmailMatterSuggestion, FiledEmail
from app.emails.schemas import EmailAttachmentCreate, FileEmailCreate, FileEmailUpdate
from app.matters.models import Matter


async def _update_matter_suggestions(
    db: AsyncSession,
    addresses: list[str],
    matter_id: uuid.UUID,
) -> None:
    """Create or update EmailMatterSuggestion entries for all provided addresses."""
    for addr in addresses:
        addr_lower = addr.strip().lower()
        if not addr_lower:
            continue
        result = await db.execute(
            select(EmailMatterSuggestion).where(
                EmailMatterSuggestion.email_address == addr_lower,
                EmailMatterSuggestion.matter_id == matter_id,
            )
        )
        suggestion = result.scalar_one_or_none()
        if suggestion:
            suggestion.use_count += 1
            suggestion.last_used = datetime.now(timezone.utc)
        else:
            db.add(
                EmailMatterSuggestion(
                    email_address=addr_lower,
                    matter_id=matter_id,
                    confidence=1.0,
                    use_count=1,
                )
            )
    await db.flush()


async def file_email(
    db: AsyncSession,
    data: FileEmailCreate,
    filed_by: uuid.UUID,
) -> FiledEmail:
    """File an email to a matter."""
    email = FiledEmail(
        matter_id=data.matter_id,
        filed_by=filed_by,
        direction=EmailDirection(data.direction),
        subject=data.subject,
        from_address=data.from_address,
        to_addresses=data.to_addresses,
        cc_addresses=data.cc_addresses,
        bcc_addresses=data.bcc_addresses,
        date_sent=data.date_sent,
        body_text=data.body_text,
        body_html=data.body_html,
        message_id=data.message_id,
        in_reply_to=data.in_reply_to,
        thread_id=data.thread_id,
        tags=data.tags,
        notes=data.notes,
        source=data.source,
    )
    db.add(email)
    await db.flush()
    await db.refresh(email)

    # Collect all addresses for suggestion updates
    all_addresses: list[str] = []
    if data.from_address:
        all_addresses.append(data.from_address)
    if data.to_addresses:
        all_addresses.extend(data.to_addresses)
    if data.cc_addresses:
        all_addresses.extend(data.cc_addresses)
    if data.bcc_addresses:
        all_addresses.extend(data.bcc_addresses)
    if all_addresses:
        await _update_matter_suggestions(db, all_addresses, data.matter_id)

    return email


async def list_filed_emails(
    db: AsyncSession,
    matter_id: Optional[uuid.UUID] = None,
    direction: Optional[str] = None,
    search: Optional[str] = None,
    from_address: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    has_attachments: Optional[bool] = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[FiledEmail], int]:
    """List filed emails with filtering and pagination."""
    query = select(FiledEmail)
    count_query = select(func.count(FiledEmail.id))

    if matter_id:
        query = query.where(FiledEmail.matter_id == matter_id)
        count_query = count_query.where(FiledEmail.matter_id == matter_id)

    if direction:
        query = query.where(FiledEmail.direction == EmailDirection(direction))
        count_query = count_query.where(FiledEmail.direction == EmailDirection(direction))

    if search:
        search_filter = or_(
            FiledEmail.subject.ilike(f"%{search}%"),
            FiledEmail.from_address.ilike(f"%{search}%"),
            FiledEmail.body_text.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if from_address:
        query = query.where(FiledEmail.from_address.ilike(f"%{from_address}%"))
        count_query = count_query.where(FiledEmail.from_address.ilike(f"%{from_address}%"))

    if start_date:
        query = query.where(FiledEmail.date_sent >= start_date)
        count_query = count_query.where(FiledEmail.date_sent >= start_date)

    if end_date:
        query = query.where(FiledEmail.date_sent <= end_date)
        count_query = count_query.where(FiledEmail.date_sent <= end_date)

    if has_attachments is not None:
        query = query.where(FiledEmail.has_attachments == has_attachments)
        count_query = count_query.where(FiledEmail.has_attachments == has_attachments)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(FiledEmail.date_sent.desc().nullslast()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_filed_email(db: AsyncSession, email_id: uuid.UUID) -> Optional[FiledEmail]:
    """Get a single filed email by ID."""
    result = await db.execute(select(FiledEmail).where(FiledEmail.id == email_id))
    return result.scalar_one_or_none()


async def update_filed_email(
    db: AsyncSession,
    email: FiledEmail,
    data: FileEmailUpdate,
) -> FiledEmail:
    """Update a filed email's notes, tags, or re-file to a different matter."""
    if data.notes is not None:
        email.notes = data.notes
    if data.tags is not None:
        email.tags = data.tags
    if data.matter_id is not None:
        email.matter_id = data.matter_id
    await db.flush()
    await db.refresh(email)
    return email


async def delete_filed_email(db: AsyncSession, email: FiledEmail) -> None:
    """Delete a filed email and its attachments."""
    await db.delete(email)
    await db.flush()


async def get_email_thread(db: AsyncSession, thread_id: str) -> list[FiledEmail]:
    """Get all emails in a thread, ordered chronologically."""
    result = await db.execute(
        select(FiledEmail).where(FiledEmail.thread_id == thread_id).order_by(FiledEmail.date_sent.asc().nullslast())
    )
    return result.scalars().all()


async def suggest_matters(
    db: AsyncSession,
    addresses: list[str],
    limit: int = 10,
) -> list[dict]:
    """Suggest matters based on email addresses, ordered by confidence * use_count."""
    if not addresses:
        return []

    normalized = [a.strip().lower() for a in addresses if a.strip()]
    if not normalized:
        return []

    result = await db.execute(
        select(
            EmailMatterSuggestion.matter_id,
            Matter.title,
            func.max(EmailMatterSuggestion.confidence).label("confidence"),
            func.sum(EmailMatterSuggestion.use_count).label("use_count"),
        )
        .join(Matter, EmailMatterSuggestion.matter_id == Matter.id)
        .where(EmailMatterSuggestion.email_address.in_(normalized))
        .group_by(EmailMatterSuggestion.matter_id, Matter.title)
        .order_by((func.max(EmailMatterSuggestion.confidence) * func.sum(EmailMatterSuggestion.use_count)).desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "matter_id": row.matter_id,
            "matter_title": row.title,
            "confidence": row.confidence,
            "use_count": row.use_count,
        }
        for row in rows
    ]


async def get_matter_email_summary(
    db: AsyncSession,
    matter_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    """Get email summary (count, latest date) per matter."""
    query = (
        select(
            FiledEmail.matter_id,
            Matter.title,
            func.count(FiledEmail.id).label("email_count"),
            func.max(FiledEmail.date_sent).label("latest_email_date"),
        )
        .join(Matter, FiledEmail.matter_id == Matter.id)
        .group_by(FiledEmail.matter_id, Matter.title)
        .order_by(func.max(FiledEmail.date_sent).desc().nullslast())
    )

    if matter_id:
        query = query.where(FiledEmail.matter_id == matter_id)

    result = await db.execute(query)
    rows = result.all()
    return [
        {
            "matter_id": row.matter_id,
            "matter_title": row.title,
            "email_count": row.email_count,
            "latest_email_date": row.latest_email_date,
        }
        for row in rows
    ]


async def add_attachment(
    db: AsyncSession,
    email_id: uuid.UUID,
    data: EmailAttachmentCreate,
) -> EmailAttachment:
    """Add attachment metadata to a filed email."""
    attachment = EmailAttachment(
        email_id=email_id,
        filename=data.filename,
        mime_type=data.mime_type,
        size_bytes=data.size_bytes,
    )
    db.add(attachment)

    # Update email attachment counters
    result = await db.execute(select(FiledEmail).where(FiledEmail.id == email_id))
    email = result.scalar_one_or_none()
    if email:
        email.has_attachments = True
        email.attachment_count = (email.attachment_count or 0) + 1

    await db.flush()
    await db.refresh(attachment)
    return attachment


async def file_email_with_attachments(
    db: AsyncSession,
    data: FileEmailCreate,
    filed_by: uuid.UUID,
    attachments: list[EmailAttachmentCreate],
) -> FiledEmail:
    """File an email and create attachment records in one operation."""
    email = await file_email(db, data, filed_by)

    for att_data in attachments:
        att = EmailAttachment(
            email_id=email.id,
            filename=att_data.filename,
            mime_type=att_data.mime_type,
            size_bytes=att_data.size_bytes,
        )
        db.add(att)

    if attachments:
        email.has_attachments = True
        email.attachment_count = len(attachments)

    await db.flush()
    await db.refresh(email)
    return email


async def search_emails_global(
    db: AsyncSession,
    search: str,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[FiledEmail], int]:
    """Search emails across all matters."""
    search_filter = or_(
        FiledEmail.subject.ilike(f"%{search}%"),
        FiledEmail.from_address.ilike(f"%{search}%"),
        FiledEmail.body_text.ilike(f"%{search}%"),
    )
    query = select(FiledEmail).where(search_filter)
    count_query = select(func.count(FiledEmail.id)).where(search_filter)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(FiledEmail.date_sent.desc().nullslast()).offset(offset).limit(page_size))
    return result.scalars().all(), total
