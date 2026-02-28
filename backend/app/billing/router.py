import json
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.billing.models import InvoiceStatus
from app.billing.schemas import (
    InvoiceCreate,
    InvoiceResponse,
    PaymentCreate,
    PaymentResponse,
    TimeEntryCreate,
    TimeEntryResponse,
    TimeEntryUpdate,
)
from app.billing.service import (
    create_invoice,
    create_payment,
    create_time_entry,
    delete_time_entry,
    get_invoice,
    get_invoices,
    get_payments,
    get_time_entries,
    get_time_entry,
    update_time_entry,
)
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles

router = APIRouter()


# Time Entries
@router.get("/time-entries", response_model=PaginatedResponse)
async def list_time_entries(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    matter_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    billable: bool | None = None,
):
    entries, total = await get_time_entries(db, page, page_size, matter_id, user_id, start_date, end_date, billable)
    items = [TimeEntryResponse.model_validate(e).model_dump() for e in entries]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("/time-entries", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_new_time_entry(
    data: TimeEntryCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    entry = await create_time_entry(db, data, current_user.id)
    await create_audit_log(
        db, current_user.id, "time_entry", str(entry.id), "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return entry


@router.put("/time-entries/{entry_id}", response_model=TimeEntryResponse)
async def update_existing_time_entry(
    entry_id: uuid.UUID,
    data: TimeEntryUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    entry = await get_time_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Time entry not found")

    # Non-admin users can only edit their own entries
    if current_user.role.value != "admin" and entry.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only edit your own time entries")

    updated = await update_time_entry(db, entry, data)
    await create_audit_log(
        db, current_user.id, "time_entry", str(entry_id), "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return updated


@router.delete("/time-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_time_entry(
    entry_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    entry = await get_time_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Time entry not found")

    if current_user.role.value != "admin" and entry.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only delete your own time entries")

    if entry.invoice_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot delete invoiced time entry")

    await delete_time_entry(db, entry)
    await create_audit_log(
        db, current_user.id, "time_entry", str(entry_id), "delete",
        ip_address=request.client.host if request.client else None,
    )


# Invoices
@router.get("/invoices", response_model=PaginatedResponse)
async def list_invoices(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    client_id: uuid.UUID | None = None,
    matter_id: uuid.UUID | None = None,
    invoice_status: InvoiceStatus | None = None,
):
    invoices, total = await get_invoices(db, page, page_size, client_id, matter_id, invoice_status)
    items = [InvoiceResponse.model_validate(i).model_dump() for i in invoices]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice_detail(
    invoice_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    invoice = await get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return invoice


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_new_invoice(
    data: InvoiceCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    invoice = await create_invoice(db, data)
    await create_audit_log(
        db, current_user.id, "invoice", str(invoice.id), "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return invoice


# Payments
@router.get("/invoices/{invoice_id}/payments", response_model=list[PaymentResponse])
async def list_payments(
    invoice_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    payments = await get_payments(db, invoice_id)
    return [PaymentResponse.model_validate(p) for p in payments]


@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_new_payment(
    data: PaymentCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    payment = await create_payment(db, data)
    await create_audit_log(
        db, current_user.id, "payment", str(payment.id), "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return payment
