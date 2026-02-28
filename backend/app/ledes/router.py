import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.ledes.models import UTBMSCodeType
from app.ledes.schemas import (
    BillingGuidelineCreate,
    BillingGuidelineResponse,
    BillingGuidelineUpdate,
    BlockBillingRequest,
    BlockBillingResponse,
    ComplianceCheckRequest,
    ComplianceCheckResponse,
    TimeEntryCodeAssign,
    TimeEntryCodeResponse,
    UTBMSCodeCreate,
    UTBMSCodeResponse,
    UTBMSCodeUpdate,
)
from app.ledes.service import (
    assign_code_to_time_entry,
    check_compliance,
    create_billing_guideline,
    create_utbms_code,
    delete_billing_guideline,
    delete_utbms_code,
    detect_block_billing,
    export_ledes_1998b,
    get_billing_guideline,
    get_billing_guidelines,
    get_time_entry_codes,
    get_utbms_code,
    get_utbms_codes,
    remove_code_from_time_entry,
    seed_utbms_codes,
    update_billing_guideline,
    update_utbms_code,
)

router = APIRouter()


# ── UTBMS Codes ──────────────────────────────────────────────────────────
@router.get("/codes", response_model=PaginatedResponse)
async def list_codes(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    code_type: Optional[UTBMSCodeType] = None,
    practice_area: Optional[str] = None,
    search: Optional[str] = None,
):
    codes, total = await get_utbms_codes(db, page, page_size, code_type, practice_area, search)
    items = [UTBMSCodeResponse.model_validate(c).model_dump() for c in codes]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("/codes", response_model=UTBMSCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_code(
    data: UTBMSCodeCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    code = await create_utbms_code(db, data)
    await create_audit_log(
        db,
        current_user.id,
        "utbms_code",
        str(code.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return code


@router.put("/codes/{code_id}", response_model=UTBMSCodeResponse)
async def update_code(
    code_id: uuid.UUID,
    data: UTBMSCodeUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    code = await get_utbms_code(db, code_id)
    if code is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UTBMS code not found")
    updated = await update_utbms_code(db, code, data)
    await create_audit_log(
        db,
        current_user.id,
        "utbms_code",
        str(code_id),
        "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return updated


@router.delete("/codes/{code_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_code(
    code_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    code = await get_utbms_code(db, code_id)
    if code is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="UTBMS code not found")
    await delete_utbms_code(db, code)
    await create_audit_log(
        db,
        current_user.id,
        "utbms_code",
        str(code_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )


@router.post("/codes/seed", status_code=status.HTTP_201_CREATED)
async def seed_codes(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    count = await seed_utbms_codes(db)
    await create_audit_log(
        db,
        current_user.id,
        "utbms_code",
        "seed",
        "create",
        changes_json=json.dumps({"codes_created": count}),
        ip_address=request.client.host if request.client else None,
    )
    return {"message": f"Seeded {count} UTBMS codes", "codes_created": count}


# ── Billing Guidelines ──────────────────────────────────────────────────
@router.get("/guidelines", response_model=PaginatedResponse)
async def list_guidelines(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    client_id: Optional[uuid.UUID] = None,
):
    guidelines, total = await get_billing_guidelines(db, page, page_size, client_id)
    items = [BillingGuidelineResponse.model_validate(g).model_dump() for g in guidelines]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("/guidelines", response_model=BillingGuidelineResponse, status_code=status.HTTP_201_CREATED)
async def create_guideline(
    data: BillingGuidelineCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    guideline = await create_billing_guideline(db, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "billing_guideline",
        str(guideline.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return guideline


@router.get("/guidelines/{guideline_id}", response_model=BillingGuidelineResponse)
async def get_guideline_detail(
    guideline_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    guideline = await get_billing_guideline(db, guideline_id)
    if guideline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing guideline not found")
    return guideline


@router.put("/guidelines/{guideline_id}", response_model=BillingGuidelineResponse)
async def update_guideline(
    guideline_id: uuid.UUID,
    data: BillingGuidelineUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    guideline = await get_billing_guideline(db, guideline_id)
    if guideline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing guideline not found")
    updated = await update_billing_guideline(db, guideline, data)
    await create_audit_log(
        db,
        current_user.id,
        "billing_guideline",
        str(guideline_id),
        "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return updated


@router.delete("/guidelines/{guideline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guideline(
    guideline_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    guideline = await get_billing_guideline(db, guideline_id)
    if guideline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing guideline not found")
    await delete_billing_guideline(db, guideline)
    await create_audit_log(
        db,
        current_user.id,
        "billing_guideline",
        str(guideline_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )


# ── Time Entry Codes ────────────────────────────────────────────────────
@router.post(
    "/time-entries/{entry_id}/codes", response_model=TimeEntryCodeResponse, status_code=status.HTTP_201_CREATED
)
async def assign_code(
    entry_id: uuid.UUID,
    data: TimeEntryCodeAssign,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    link = await assign_code_to_time_entry(db, entry_id, data.utbms_code_id)
    # Enrich with code details
    response = TimeEntryCodeResponse.model_validate(link)
    if link.utbms_code:
        response.code = link.utbms_code.code
        response.code_type = link.utbms_code.code_type
        response.code_name = link.utbms_code.name
    await create_audit_log(
        db,
        current_user.id,
        "time_entry_code",
        str(link.id),
        "create",
        changes_json=json.dumps({"time_entry_id": str(entry_id), "utbms_code_id": str(data.utbms_code_id)}),
        ip_address=request.client.host if request.client else None,
    )
    return response


@router.delete("/time-entries/{entry_id}/codes/{code_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_code(
    entry_id: uuid.UUID,
    code_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    removed = await remove_code_from_time_entry(db, entry_id, code_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code assignment not found")
    await create_audit_log(
        db,
        current_user.id,
        "time_entry_code",
        f"{entry_id}:{code_id}",
        "delete",
        ip_address=request.client.host if request.client else None,
    )


@router.get("/time-entries/{entry_id}/codes", response_model=list[TimeEntryCodeResponse])
async def list_entry_codes(
    entry_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    codes = await get_time_entry_codes(db, entry_id)
    results = []
    for link in codes:
        response = TimeEntryCodeResponse.model_validate(link)
        if link.utbms_code:
            response.code = link.utbms_code.code
            response.code_type = link.utbms_code.code_type
            response.code_name = link.utbms_code.name
        results.append(response)
    return results


# ── Compliance & Block Billing ───────────────────────────────────────────
@router.post("/check-compliance", response_model=ComplianceCheckResponse)
async def check_entry_compliance(
    data: ComplianceCheckRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return await check_compliance(db, data.time_entry_id, data.client_id)


@router.post("/detect-block-billing", response_model=BlockBillingResponse)
async def detect_block(
    data: BlockBillingRequest,
    current_user: Annotated[User, Depends(get_current_user)],
):
    return detect_block_billing(data.description, data.duration_minutes)


# ── LEDES Export ─────────────────────────────────────────────────────────
@router.get("/export/ledes/{invoice_id}")
async def export_ledes(
    invoice_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    content = await export_ledes_1998b(db, invoice_id)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    def generate():
        yield content

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=ledes_{invoice_id}.txt"},
    )
