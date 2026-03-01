import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.payments.models import PaymentLinkStatus, PaymentProcessor
from app.payments.schemas import (
    CompletePaymentRequest,
    CreatePaymentLinkRequest,
    PaymentLinkResponse,
    PaymentSettingsCreate,
    PaymentSettingsResponse,
    PaymentSummaryReport,
    PublicPaymentInfo,
    SendPaymentLinkRequest,
    SendPaymentLinkResponse,
)
from app.payments.service import (
    build_payment_link_response,
    build_settings_response,
    cancel_payment_link,
    create_or_update_payment_settings,
    create_payment_link,
    get_payment_link,
    get_payment_settings,
    get_payment_summary,
    get_public_payment_info,
    list_payment_links,
    mark_payment_link_paid,
    process_webhook,
    send_payment_link_notification,
)

router = APIRouter()


# ── Payment Settings (admin only) ────────────────────────────────────


@router.get("/settings", response_model=PaymentSettingsResponse)
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    ps = await get_payment_settings(db)
    if ps is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment settings not configured")
    return build_settings_response(ps)


@router.post("/settings", response_model=PaymentSettingsResponse)
async def upsert_settings(
    data: PaymentSettingsCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    ps = await create_or_update_payment_settings(db, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "payment_settings",
        str(ps.id),
        "update",
        changes_json=json.dumps({"processor": data.processor.value, "is_active": data.is_active}, default=str),
        ip_address=request.client.host if request.client else None,
    )
    return build_settings_response(ps)


# ── Payment Links ───────────────────────────────────────────────────


@router.get("/links", response_model=PaginatedResponse)
async def list_links(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    link_status: Optional[PaymentLinkStatus] = None,
    client_id: Optional[uuid.UUID] = None,
    invoice_id: Optional[uuid.UUID] = None,
):
    links, total = await list_payment_links(db, page, page_size, link_status, client_id, invoice_id)
    items = [build_payment_link_response(link).model_dump() for link in links]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("/links", response_model=PaymentLinkResponse, status_code=status.HTTP_201_CREATED)
async def create_link(
    data: CreatePaymentLinkRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        link = await create_payment_link(db, data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await create_audit_log(
        db,
        current_user.id,
        "payment_link",
        str(link.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return build_payment_link_response(link)


@router.get("/links/{link_id}", response_model=PaymentLinkResponse)
async def get_link_detail(
    link_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    link = await get_payment_link(db, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")
    return build_payment_link_response(link)


@router.post("/links/{link_id}/cancel", response_model=PaymentLinkResponse)
async def cancel_link(
    link_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    link = await get_payment_link(db, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")
    try:
        link = await cancel_payment_link(db, link)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await create_audit_log(
        db,
        current_user.id,
        "payment_link",
        str(link.id),
        "cancel",
        ip_address=request.client.host if request.client else None,
    )
    return build_payment_link_response(link)


@router.post("/links/{link_id}/send", response_model=SendPaymentLinkResponse)
async def send_link(
    link_id: uuid.UUID,
    data: SendPaymentLinkRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    link = await get_payment_link(db, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found")

    result = await send_payment_link_notification(db, link, data)

    await create_audit_log(
        db,
        current_user.id,
        "payment_link",
        str(link.id),
        "send_notification",
        ip_address=request.client.host if request.client else None,
    )
    return result


# ── Public Payment Endpoints (no auth) ──────────────────────────────


@router.get("/pay/{access_token}", response_model=PublicPaymentInfo)
async def get_payment_page(
    access_token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    info = await get_public_payment_info(db, access_token)
    if info is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment link not found or expired")
    return info


@router.post("/pay/{access_token}/complete", response_model=PaymentLinkResponse)
async def complete_payment(
    access_token: str,
    data: CompletePaymentRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        link = await mark_payment_link_paid(db, access_token, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return build_payment_link_response(link)


# ── Webhooks (public, processor-specific) ────────────────────────────


@router.post("/webhooks/{processor}")
async def receive_webhook(
    processor: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        proc = PaymentProcessor(processor)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown processor: {processor}")

    try:
        body = await request.json()
    except Exception:
        body = {}

    event_type = body.get("type", "unknown")
    event_id = body.get("id")

    try:
        event = await process_webhook(db, proc, event_type, event_id, body)
    except ValueError as e:
        # Duplicate event — return 200 to prevent retries
        return {"status": "duplicate", "message": str(e)}

    return {"status": "received", "event_id": str(event.id)}


# ── Payment Summary Report ──────────────────────────────────────────


@router.get("/summary", response_model=PaymentSummaryReport)
async def payment_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return await get_payment_summary(db)
