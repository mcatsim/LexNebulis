import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.esign.schemas import (
    DeclineRequest,
    SignatureAuditEntryResponse,
    SignatureRequestCreate,
    SignatureRequestResponse,
    SigningPageInfo,
    SignRequest,
)
from app.esign.service import (
    cancel_signature_request,
    create_signature_request,
    decline_document,
    get_audit_trail,
    get_certificate_download_url,
    get_signature_request,
    get_signing_page_info,
    list_signature_requests,
    send_signature_request,
    sign_document,
)

router = APIRouter()


# ── Authenticated routes ────────────────────────────────────────────────────────


@router.post("", response_model=SignatureRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    data: SignatureRequestCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    sig_request = await create_signature_request(db, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "esign",
        str(sig_request.id),
        "create",
        changes_json=json.dumps({"title": data.title, "signers": len(data.signers)}),
        ip_address=request.client.host if request.client else None,
    )
    return sig_request


@router.get("", response_model=PaginatedResponse)
async def list_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    matter_id: Optional[uuid.UUID] = None,
    request_status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
):
    requests, total = await list_signature_requests(db, matter_id, request_status, page, page_size)
    items = [SignatureRequestResponse.model_validate(r).model_dump() for r in requests]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{request_id}", response_model=SignatureRequestResponse)
async def get_request_detail(
    request_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    sig_request = await get_signature_request(db, request_id)
    if sig_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signature request not found")
    return sig_request


@router.get("/{request_id}/audit", response_model=list[SignatureAuditEntryResponse])
async def get_request_audit_trail(
    request_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    sig_request = await get_signature_request(db, request_id)
    if sig_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signature request not found")
    entries = await get_audit_trail(db, request_id)
    return entries


@router.post("/{request_id}/send", response_model=SignatureRequestResponse)
async def send_request(
    request_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    try:
        sig_request = await send_signature_request(
            db, request_id, ip_address=request.client.host if request.client else None
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await create_audit_log(
        db,
        current_user.id,
        "esign",
        str(request_id),
        "send",
        ip_address=request.client.host if request.client else None,
    )
    return sig_request


@router.post("/{request_id}/cancel", response_model=SignatureRequestResponse)
async def cancel_request(
    request_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    try:
        sig_request = await cancel_signature_request(
            db, request_id, ip_address=request.client.host if request.client else None
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await create_audit_log(
        db,
        current_user.id,
        "esign",
        str(request_id),
        "cancel",
        ip_address=request.client.host if request.client else None,
    )
    return sig_request


@router.get("/{request_id}/certificate")
async def download_certificate(
    request_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    sig_request = await get_signature_request(db, request_id)
    if sig_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signature request not found")
    if sig_request.status != "completed" or not sig_request.certificate_storage_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Certificate not available")

    url = get_certificate_download_url(sig_request.certificate_storage_key)
    return RedirectResponse(url=url)


# ── Public signing routes (no auth) ────────────────────────────────────────────


@router.get("/sign/{access_token}", response_model=SigningPageInfo)
async def get_signing_page(
    access_token: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        signer, sig_request, download_url = await get_signing_page_info(
            db,
            access_token,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return SigningPageInfo(
        request_title=sig_request.title,
        message=sig_request.message,
        signer_name=signer.name,
        signer_email=signer.email,
        signer_status=signer.status.value,
        document_download_url=download_url,
    )


@router.post("/sign/{access_token}")
async def sign(
    access_token: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    body: SignRequest = SignRequest(),
):
    try:
        signer = await sign_document(
            db,
            access_token,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"status": "signed", "signer_name": signer.name, "signed_at": signer.signed_at.isoformat()}


@router.post("/sign/{access_token}/decline")
async def decline(
    access_token: str,
    body: DeclineRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        signer = await decline_document(
            db,
            access_token,
            reason=body.reason,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"status": "declined", "signer_name": signer.name}
