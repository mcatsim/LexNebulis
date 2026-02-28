import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.conflicts.models import ConflictStatus
from app.conflicts.schemas import (
    ConflictCheckCreate,
    ConflictCheckListResponse,
    ConflictCheckResponse,
    ConflictMatchResolve,
    ConflictMatchResponse,
    EthicalWallCreate,
    EthicalWallResponse,
)
from app.conflicts.service import (
    create_ethical_wall,
    get_conflict_check,
    get_conflict_checks,
    get_ethical_walls,
    remove_ethical_wall,
    resolve_match,
    run_conflict_check,
)
from app.database import get_db
from app.dependencies import get_current_user, require_roles

router = APIRouter()


@router.post("/check", response_model=ConflictCheckResponse, status_code=status.HTTP_201_CREATED)
async def run_check(
    data: ConflictCheckCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    check = await run_conflict_check(db, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "conflict_check",
        str(check.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return check


@router.get("/checks", response_model=PaginatedResponse)
async def list_checks(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    matter_id: Optional[uuid.UUID] = None,
    status_filter: Optional[ConflictStatus] = None,
):
    checks, total = await get_conflict_checks(db, page, page_size, matter_id, status_filter)
    items = []
    for c in checks:
        resp = ConflictCheckListResponse.model_validate(c)
        resp.match_count = len(c.matches) if c.matches else 0
        items.append(resp.model_dump())
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/checks/{check_id}", response_model=ConflictCheckResponse)
async def get_check_detail(
    check_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    check = await get_conflict_check(db, check_id)
    if check is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflict check not found")
    return check


@router.put("/matches/{match_id}/resolve", response_model=ConflictMatchResponse)
async def resolve_conflict_match(
    match_id: uuid.UUID,
    data: ConflictMatchResolve,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    match = await resolve_match(db, match_id, data, current_user.id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflict match not found")

    await create_audit_log(
        db,
        current_user.id,
        "conflict_match",
        str(match_id),
        "update",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return match


@router.post("/ethical-walls", response_model=EthicalWallResponse, status_code=status.HTTP_201_CREATED)
async def create_wall(
    data: EthicalWallCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    wall = await create_ethical_wall(db, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "ethical_wall",
        str(wall.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return wall


@router.get("/ethical-walls/{matter_id}", response_model=list[EthicalWallResponse])
async def list_walls(
    matter_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    walls = await get_ethical_walls(db, matter_id)
    return walls


@router.delete("/ethical-walls/{wall_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wall(
    wall_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    wall = await remove_ethical_wall(db, wall_id)
    if wall is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ethical wall not found")

    await create_audit_log(
        db,
        current_user.id,
        "ethical_wall",
        str(wall_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )
