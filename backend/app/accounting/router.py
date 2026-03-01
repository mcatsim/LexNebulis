import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounting.models import AccountType, ExportFormat
from app.accounting.schemas import (
    AccountMappingCreate,
    AccountMappingResponse,
    AccountMappingUpdate,
    ChartOfAccountsCreate,
    ChartOfAccountsResponse,
    ChartOfAccountsUpdate,
    ExportHistoryResponse,
    ExportPreview,
    ExportRequest,
    SeedAccountsRequest,
)
from app.accounting.service import (
    build_mapping_response,
    create_account,
    create_mapping,
    delete_account,
    delete_mapping,
    generate_csv_export,
    generate_export_preview,
    generate_iif_export,
    generate_qbo_json_export,
    get_account,
    list_accounts,
    list_export_history,
    list_mappings,
    seed_default_accounts,
    update_account,
    update_mapping,
)
from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles

router = APIRouter()


# ---------------------------------------------------------------------------
# Chart of Accounts
# ---------------------------------------------------------------------------
@router.get("/accounts", response_model=PaginatedResponse)
async def list_accounts_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    account_type: Optional[AccountType] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    accounts, total = await list_accounts(db, page, page_size, account_type, search, is_active)
    items = [ChartOfAccountsResponse.model_validate(a).model_dump() for a in accounts]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("/accounts", response_model=ChartOfAccountsResponse, status_code=status.HTTP_201_CREATED)
async def create_account_endpoint(
    data: ChartOfAccountsCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    account = await create_account(db, data, current_user.id)
    await create_audit_log(
        db,
        user_id=current_user.id,
        entity_type="chart_of_accounts",
        entity_id=str(account.id),
        action="create",
        changes_json=json.dumps(data.model_dump(mode="json")),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return account


@router.get("/accounts/{account_id}", response_model=ChartOfAccountsResponse)
async def get_account_endpoint(
    account_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    account = await get_account(db, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.put("/accounts/{account_id}", response_model=ChartOfAccountsResponse)
async def update_account_endpoint(
    account_id: uuid.UUID,
    data: ChartOfAccountsUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    try:
        updated = await update_account(db, account_id, data)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    await create_audit_log(
        db,
        user_id=current_user.id,
        entity_type="chart_of_accounts",
        entity_id=str(account_id),
        action="update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True, mode="json")),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return updated


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account_endpoint(
    account_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    try:
        await delete_account(db, account_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    await create_audit_log(
        db,
        user_id=current_user.id,
        entity_type="chart_of_accounts",
        entity_id=str(account_id),
        action="delete",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/accounts/seed", status_code=status.HTTP_201_CREATED)
async def seed_accounts_endpoint(
    body: SeedAccountsRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    try:
        created = await seed_default_accounts(db, body.template, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await create_audit_log(
        db,
        user_id=current_user.id,
        entity_type="chart_of_accounts",
        entity_id="seed",
        action="seed",
        changes_json=json.dumps({"template": body.template, "accounts_created": len(created)}),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"message": f"Seeded {len(created)} accounts", "accounts_created": len(created)}


# ---------------------------------------------------------------------------
# Account Mappings
# ---------------------------------------------------------------------------
@router.get("/mappings")
async def list_mappings_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
    account_id: Optional[uuid.UUID] = None,
    source_type: Optional[str] = None,
):
    mappings = await list_mappings(db, account_id=account_id, source_type=source_type)
    items = []
    for m in mappings:
        resp = await build_mapping_response(m)
        items.append(resp.model_dump())
    return items


@router.post("/mappings", response_model=AccountMappingResponse, status_code=status.HTTP_201_CREATED)
async def create_mapping_endpoint(
    data: AccountMappingCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    mapping = await create_mapping(db, data)
    await create_audit_log(
        db,
        user_id=current_user.id,
        entity_type="account_mapping",
        entity_id=str(mapping.id),
        action="create",
        changes_json=json.dumps(data.model_dump(mode="json")),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return await build_mapping_response(mapping)


@router.put("/mappings/{mapping_id}", response_model=AccountMappingResponse)
async def update_mapping_endpoint(
    mapping_id: uuid.UUID,
    data: AccountMappingUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    try:
        updated = await update_mapping(db, mapping_id, data)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping not found")

    await create_audit_log(
        db,
        user_id=current_user.id,
        entity_type="account_mapping",
        entity_id=str(mapping_id),
        action="update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True, mode="json")),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return await build_mapping_response(updated)


@router.delete("/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mapping_endpoint(
    mapping_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    try:
        await delete_mapping(db, mapping_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mapping not found")

    await create_audit_log(
        db,
        user_id=current_user.id,
        entity_type="account_mapping",
        entity_id=str(mapping_id),
        action="delete",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
@router.post("/export/preview", response_model=ExportPreview)
async def preview_export_endpoint(
    data: ExportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    return await generate_export_preview(db, data)


@router.post("/export/generate")
async def generate_export_endpoint(
    data: ExportRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
):
    if data.format == ExportFormat.iif:
        content = await generate_iif_export(db, data, current_user.id)
        filename = f"export_{data.export_type}_{data.start_date}_{data.end_date}.iif"
        await create_audit_log(
            db,
            user_id=current_user.id,
            entity_type="export",
            entity_id=filename,
            action="export",
            changes_json=json.dumps(
                {
                    "format": data.format.value,
                    "export_type": data.export_type,
                    "start_date": str(data.start_date),
                    "end_date": str(data.end_date),
                }
            ),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        return StreamingResponse(
            iter([content]),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    elif data.format == ExportFormat.csv:
        content = await generate_csv_export(db, data, current_user.id)
        filename = f"export_{data.export_type}_{data.start_date}_{data.end_date}.csv"
        await create_audit_log(
            db,
            user_id=current_user.id,
            entity_type="export",
            entity_id=filename,
            action="export",
            changes_json=json.dumps(
                {
                    "format": data.format.value,
                    "export_type": data.export_type,
                    "start_date": str(data.start_date),
                    "end_date": str(data.end_date),
                }
            ),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        return StreamingResponse(
            iter([content]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    elif data.format == ExportFormat.qbo_json:
        export_data = await generate_qbo_json_export(db, data, current_user.id)
        filename = f"export_{data.export_type}_{data.start_date}_{data.end_date}.json"
        await create_audit_log(
            db,
            user_id=current_user.id,
            entity_type="export",
            entity_id=filename,
            action="export",
            changes_json=json.dumps(
                {
                    "format": data.format.value,
                    "export_type": data.export_type,
                    "start_date": str(data.start_date),
                    "end_date": str(data.end_date),
                }
            ),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        return export_data

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unsupported export format: {data.format}",
    )


@router.get("/export/history", response_model=PaginatedResponse)
async def list_export_history_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "billing_clerk"))],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    export_format: Optional[ExportFormat] = None,
):
    history, total = await list_export_history(db, page, page_size, export_format)
    items = [ExportHistoryResponse.model_validate(h).model_dump() for h in history]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)
