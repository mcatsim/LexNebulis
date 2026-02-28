import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import AuditLog, RefreshToken, User, UserRole
from app.auth.schemas import UserCreate
from app.config import settings
from app.database import async_session

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": user_id, "role": role, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token_value() -> str:
    return str(uuid.uuid4())


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return None

    # Check lockout
    if user.locked_until and user.locked_until > datetime.now(UTC):
        return None

    if not verify_password(password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.max_login_attempts:
            user.locked_until = datetime.now(UTC) + timedelta(minutes=settings.lockout_duration_minutes)
        await db.flush()
        return None

    # Reset failed attempts on success
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.flush()
    return user


async def create_refresh_token(db: AsyncSession, user_id: uuid.UUID) -> str:
    token_value = create_refresh_token_value()
    token = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(token_value),
        expires_at=datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    db.add(token)
    await db.flush()
    return token_value


async def rotate_refresh_token(db: AsyncSession, old_token: str) -> tuple[User, str] | None:
    token_hash = hash_token(old_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
            RefreshToken.expires_at > datetime.now(UTC),
        )
    )
    token = result.scalar_one_or_none()
    if token is None:
        return None

    # Revoke old token
    token.revoked = True

    # Get user
    user_result = await db.execute(select(User).where(User.id == token.user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None

    # Issue new refresh token
    new_token_value = await create_refresh_token(db, user.id)
    await db.flush()
    return user, new_token_value


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role,
    )
    db.add(user)
    await db.flush()
    return user


async def create_audit_log(
    db: AsyncSession,
    user_id: uuid.UUID | None,
    entity_type: str,
    entity_id: str,
    action: str,
    changes_json: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    user_email: str | None = None,
    outcome: str = "success",
):
    from app.common.audit import ACTION_SEVERITY, compute_integrity_hash

    # Get the previous entry's hash for the chain
    prev_result = await db.execute(
        select(AuditLog.integrity_hash)
        .order_by(AuditLog.timestamp.desc())
        .limit(1)
    )
    previous_hash = prev_result.scalar_one_or_none()

    # Determine severity
    severity = ACTION_SEVERITY.get(action, "info")

    # Generate entry ID and timestamp
    entry_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    # Compute integrity hash (nonrepudiation chain)
    integrity_hash = compute_integrity_hash(
        entry_id, now, str(user_id) if user_id else None,
        action, entity_type, str(entity_id), changes_json, previous_hash,
    )

    entry = AuditLog(
        id=uuid.UUID(entry_id),
        user_id=user_id,
        user_email=user_email,
        entity_type=entity_type,
        entity_id=str(entity_id),
        action=action,
        changes_json=changes_json,
        ip_address=ip_address,
        user_agent=user_agent,
        outcome=outcome,
        severity=severity,
        integrity_hash=integrity_hash,
        previous_hash=previous_hash,
    )
    db.add(entry)
    await db.flush()


async def bootstrap_admin():
    """Create the first admin user if no users exist."""
    async with async_session() as db:
        result = await db.execute(select(User).limit(1))
        if result.scalar_one_or_none() is not None:
            return

        admin = User(
            email=settings.first_admin_email,
            password_hash=hash_password(settings.first_admin_password),
            first_name="Admin",
            last_name="User",
            role=UserRole.admin,
        )
        db.add(admin)
        await db.commit()
        print(f"Bootstrap admin created: {settings.first_admin_email}")
