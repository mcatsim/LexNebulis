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
from app.trust.schemas import (
    TrustAccountCreate,
    TrustAccountResponse,
    TrustLedgerEntryCreate,
    TrustLedgerEntryResponse,
    TrustReconciliationCreate,
    TrustReconciliationResponse,
)
from app.trust.service import (
    create_ledger_entry,
    create_reconciliation,
    create_trust_account,
    get_ledger_entries,
    get_trust_accounts,
)

router = APIRouter()


@router.get("/accounts", response_model=list[TrustAccountResponse])
async def list_trust_accounts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    accounts = await get_trust_accounts(db)
    return [TrustAccountResponse.model_validate(a) for a in accounts]


@router.post("/accounts", response_model=TrustAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_new_trust_account(
    data: TrustAccountCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    account = await create_trust_account(db, data)
    await create_audit_log(
        db,
        current_user.id,
        "trust_account",
        str(account.id),
        "create",
        changes_json=json.dumps({"account_name": data.account_name, "bank_name": data.bank_name}),
        ip_address=request.client.host if request.client else None,
    )
    return account


@router.get("/accounts/{account_id}/ledger", response_model=PaginatedResponse)
async def list_ledger_entries(
    account_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 50,
    client_id: Optional[uuid.UUID] = None,
):
    entries, total = await get_ledger_entries(db, account_id, page, page_size, client_id)
    items = [TrustLedgerEntryResponse.model_validate(e).model_dump() for e in entries]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("/ledger", response_model=TrustLedgerEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_new_ledger_entry(
    data: TrustLedgerEntryCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    try:
        entry = await create_ledger_entry(db, data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await create_audit_log(
        db,
        current_user.id,
        "trust_ledger_entry",
        str(entry.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return entry


@router.post("/reconciliations", response_model=TrustReconciliationResponse, status_code=status.HTTP_201_CREATED)
async def create_new_reconciliation(
    data: TrustReconciliationCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    try:
        recon = await create_reconciliation(db, data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await create_audit_log(
        db,
        current_user.id,
        "trust_reconciliation",
        str(recon.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return recon
