import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.schemas import (
    LoginRequest,
    PasswordChange,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.auth.service import (
    authenticate_user,
    create_access_token,
    create_audit_log,
    create_refresh_token,
    create_user,
    hash_password,
    rotate_refresh_token,
    verify_password,
)
from app.common.pagination import PaginatedResponse, PaginationParams
from app.database import get_db
from app.dependencies import get_current_user, require_roles

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await authenticate_user(db, data.email, data.password)
    if user is None:
        # Commit to persist failed-login counter / lockout state before
        # raising, because the dependency's exception handler will rollback.
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(str(user.id), user.role.value)
    refresh_token = await create_refresh_token(db, user.id)

    await create_audit_log(db, user.id, "user", str(user.id), "login", ip_address=request.client.host if request.client else None)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await rotate_refresh_token(db, data.refresh_token)
    if result is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user, new_refresh = result
    access_token = create_access_token(str(user.id), user.role.value)
    return TokenResponse(access_token=access_token, refresh_token=new_refresh)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


@router.put("/me/password")
async def change_password(
    data: PasswordChange,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    current_user.password_hash = hash_password(data.new_password)
    await db.flush()
    return {"message": "Password updated"}


# Admin-only user management
@router.get("/users", response_model=PaginatedResponse)
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
    page: int = 1,
    page_size: int = 25,
):
    pagination = PaginationParams(page=page, page_size=page_size)
    count_result = await db.execute(select(func.count(User.id)))
    total = count_result.scalar_one()

    result = await db.execute(
        select(User).order_by(User.last_name, User.first_name).offset(pagination.offset).limit(pagination.page_size)
    )
    users = result.scalars().all()
    items = [UserResponse.model_validate(u) for u in users]
    return PaginatedResponse.create(items=[i.model_dump() for i in items], total=total, page=pagination.page, page_size=pagination.page_size)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    data: UserCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    # Check for existing email
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = await create_user(db, data)
    await create_audit_log(
        db, admin.id, "user", str(user.id), "create",
        changes_json=json.dumps({"email": data.email, "role": data.role.value}),
        ip_address=request.client.host if request.client else None,
    )
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    import uuid as _uuid
    result = await db.execute(select(User).where(User.id == _uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    changes = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        old_value = getattr(user, field)
        if field == "role" and value is not None:
            value_str = value.value if hasattr(value, "value") else value
            old_str = old_value.value if hasattr(old_value, "value") else old_value
            if value_str != old_str:
                changes[field] = {"old": old_str, "new": value_str}
            setattr(user, field, value)
        elif value is not None and value != old_value:
            changes[field] = {"old": str(old_value), "new": str(value)}
            setattr(user, field, value)

    if changes:
        await create_audit_log(
            db, admin.id, "user", str(user.id), "update",
            changes_json=json.dumps(changes),
            ip_address=request.client.host if request.client else None,
        )

    await db.flush()
    await db.refresh(user)
    return user
