import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.models import Invoice, InvoiceLineItem, InvoiceStatus, Payment, RateSchedule, TimeEntry
from app.billing.schemas import InvoiceCreate, PaymentCreate, TimeEntryCreate, TimeEntryUpdate


# Time Entries
async def get_time_entries(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    matter_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    billable: bool | None = None,
) -> tuple[list[TimeEntry], int]:
    query = select(TimeEntry)
    count_query = select(func.count(TimeEntry.id))

    if matter_id:
        query = query.where(TimeEntry.matter_id == matter_id)
        count_query = count_query.where(TimeEntry.matter_id == matter_id)
    if user_id:
        query = query.where(TimeEntry.user_id == user_id)
        count_query = count_query.where(TimeEntry.user_id == user_id)
    if start_date:
        query = query.where(TimeEntry.date >= start_date)
        count_query = count_query.where(TimeEntry.date >= start_date)
    if end_date:
        query = query.where(TimeEntry.date <= end_date)
        count_query = count_query.where(TimeEntry.date <= end_date)
    if billable is not None:
        query = query.where(TimeEntry.billable == billable)
        count_query = count_query.where(TimeEntry.billable == billable)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(TimeEntry.date.desc(), TimeEntry.created_at.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_time_entry(db: AsyncSession, entry_id: uuid.UUID) -> TimeEntry | None:
    result = await db.execute(select(TimeEntry).where(TimeEntry.id == entry_id))
    return result.scalar_one_or_none()


async def create_time_entry(db: AsyncSession, data: TimeEntryCreate, user_id: uuid.UUID) -> TimeEntry:
    entry = TimeEntry(**data.model_dump(), user_id=user_id)
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


async def update_time_entry(db: AsyncSession, entry: TimeEntry, data: TimeEntryUpdate) -> TimeEntry:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.flush()
    await db.refresh(entry)
    return entry


async def delete_time_entry(db: AsyncSession, entry: TimeEntry) -> None:
    await db.delete(entry)
    await db.flush()


# Rate Schedules
async def get_user_rate(db: AsyncSession, user_id: uuid.UUID, matter_id: uuid.UUID | None = None, for_date: date | None = None) -> int:
    if for_date is None:
        for_date = date.today()

    # Try matter-specific rate first
    if matter_id:
        result = await db.execute(
            select(RateSchedule)
            .where(RateSchedule.user_id == user_id, RateSchedule.matter_id == matter_id, RateSchedule.effective_date <= for_date)
            .order_by(RateSchedule.effective_date.desc())
            .limit(1)
        )
        rate = result.scalar_one_or_none()
        if rate:
            return rate.rate_cents

    # Fall back to default rate
    result = await db.execute(
        select(RateSchedule)
        .where(RateSchedule.user_id == user_id, RateSchedule.matter_id.is_(None), RateSchedule.effective_date <= for_date)
        .order_by(RateSchedule.effective_date.desc())
        .limit(1)
    )
    rate = result.scalar_one_or_none()
    return rate.rate_cents if rate else 30000  # Default $300/hr


# Invoices
async def get_invoices(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    client_id: uuid.UUID | None = None,
    matter_id: uuid.UUID | None = None,
    status: InvoiceStatus | None = None,
) -> tuple[list[Invoice], int]:
    query = select(Invoice)
    count_query = select(func.count(Invoice.id))

    if client_id:
        query = query.where(Invoice.client_id == client_id)
        count_query = count_query.where(Invoice.client_id == client_id)
    if matter_id:
        query = query.where(Invoice.matter_id == matter_id)
        count_query = count_query.where(Invoice.matter_id == matter_id)
    if status:
        query = query.where(Invoice.status == status)
        count_query = count_query.where(Invoice.status == status)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(Invoice.invoice_number.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_invoice(db: AsyncSession, invoice_id: uuid.UUID) -> Invoice | None:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    return result.scalar_one_or_none()


async def create_invoice(db: AsyncSession, data: InvoiceCreate) -> Invoice:
    invoice = Invoice(
        client_id=data.client_id,
        matter_id=data.matter_id,
        issued_date=data.issued_date,
        due_date=data.due_date,
        notes=data.notes,
    )
    db.add(invoice)
    await db.flush()

    # Link time entries and create line items
    subtotal = 0
    if data.time_entry_ids:
        result = await db.execute(select(TimeEntry).where(TimeEntry.id.in_(data.time_entry_ids)))
        entries = result.scalars().all()
        for entry in entries:
            entry.invoice_id = invoice.id
            hours = entry.duration_minutes / 60
            amount = int(hours * entry.rate_cents)
            line_item = InvoiceLineItem(
                invoice_id=invoice.id,
                time_entry_id=entry.id,
                description=entry.description,
                quantity=entry.duration_minutes,
                rate_cents=entry.rate_cents,
                amount_cents=amount,
            )
            db.add(line_item)
            subtotal += amount

    invoice.subtotal_cents = subtotal
    invoice.total_cents = subtotal + invoice.tax_cents
    await db.flush()
    await db.refresh(invoice)
    return invoice


# Payments
async def create_payment(db: AsyncSession, data: PaymentCreate) -> Payment:
    payment = Payment(**data.model_dump())
    db.add(payment)

    # Check if invoice is fully paid
    invoice = await get_invoice(db, data.invoice_id)
    if invoice:
        result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(Payment.invoice_id == invoice.id)
        )
        total_paid = result.scalar_one() + data.amount_cents
        if total_paid >= invoice.total_cents:
            invoice.status = InvoiceStatus.paid

    await db.flush()
    await db.refresh(payment)
    return payment


async def get_payments(db: AsyncSession, invoice_id: uuid.UUID) -> list[Payment]:
    result = await db.execute(select(Payment).where(Payment.invoice_id == invoice_id).order_by(Payment.payment_date.desc()))
    return result.scalars().all()
