import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
import pyotp
from passlib.context import CryptContext
from sqlalchemy import select
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
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {"sub": user_id, "role": role, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token_value() -> str:
    return str(uuid.uuid4())


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_2fa_pending_token(user_id: str) -> str:
    """Create a short-lived JWT for 2FA pending verification (5 min)."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {"sub": user_id, "type": "2fa_pending", "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def verify_2fa_pending_token(token: str) -> Optional[str]:
    """Verify a 2FA pending token and return the user_id, or None if invalid."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if user_id is None or token_type != "2fa_pending":
            return None
        return user_id
    except Exception:
        return None


# ── TOTP / Two-Factor Authentication ────────────────────────────────


def generate_totp_secret() -> str:
    """Generate a new TOTP secret."""
    return pyotp.random_base32()


def get_totp_provisioning_uri(secret: str, email: str) -> str:
    """Generate the QR code provisioning URI."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name="LexNebulis")


def verify_totp_code(secret: str, code: str) -> bool:
    """Verify a TOTP code with a 30-second window tolerance."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def generate_recovery_codes(count: int = 8) -> list[str]:
    """Generate plaintext recovery codes."""
    return [secrets.token_hex(4).upper() for _ in range(count)]


def hash_recovery_codes(codes: list[str]) -> str:
    """Hash recovery codes for storage."""
    hashed = [hashlib.sha256(c.encode()).hexdigest() for c in codes]
    return json.dumps(hashed)


def verify_recovery_code(stored_hashes_json: str, code: str) -> tuple[bool, str]:
    """Verify a recovery code. Returns (valid, updated_hashes_json) with used code removed."""
    code_hash = hashlib.sha256(code.upper().encode()).hexdigest()
    hashes = json.loads(stored_hashes_json)
    if code_hash in hashes:
        hashes.remove(code_hash)
        return True, json.dumps(hashes)
    return False, stored_hashes_json


def generate_qr_code_base64(provisioning_uri: str) -> str:
    """Generate a QR code as a base64-encoded PNG string."""
    import base64
    import io

    import qrcode

    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


async def setup_2fa(db: AsyncSession, user: User) -> dict:
    """Initialize 2FA setup — generates secret and returns provisioning URI + QR code."""
    secret = generate_totp_secret()
    user.totp_secret = secret
    user.totp_verified = False
    await db.flush()
    uri = get_totp_provisioning_uri(secret, user.email)
    qr_code_base64 = generate_qr_code_base64(uri)
    return {"secret": secret, "provisioning_uri": uri, "qr_code_base64": qr_code_base64}


async def verify_2fa_setup(db: AsyncSession, user: User, code: str) -> dict:
    """Verify the TOTP setup and generate recovery codes."""
    if not user.totp_secret:
        raise ValueError("2FA not initialized")
    if not verify_totp_code(user.totp_secret, code):
        raise ValueError("Invalid verification code")

    recovery_codes = generate_recovery_codes()
    user.totp_enabled = True
    user.totp_verified = True
    user.recovery_codes = hash_recovery_codes(recovery_codes)
    await db.flush()
    return {"recovery_codes": recovery_codes}


async def disable_2fa(db: AsyncSession, user: User, code: str) -> None:
    """Disable 2FA after verifying current code."""
    if not user.totp_enabled or not user.totp_secret:
        raise ValueError("2FA is not enabled")
    if not verify_totp_code(user.totp_secret, code):
        raise ValueError("Invalid verification code")

    user.totp_secret = None
    user.totp_enabled = False
    user.totp_verified = False
    user.recovery_codes = None
    await db.flush()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return None

    # Check lockout — handle both naive and aware datetimes (SQLite
    # may strip timezone info when round-tripping DateTime values).
    if user.locked_until is not None:
        now_utc = datetime.now(timezone.utc)
        locked = user.locked_until
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=timezone.utc)
        if locked > now_utc:
            return None

    if not verify_password(password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.max_login_attempts:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.lockout_duration_minutes)
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
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    db.add(token)
    await db.flush()
    return token_value


async def rotate_refresh_token(db: AsyncSession, old_token: str) -> Optional[tuple[User, str]]:
    token_hash = hash_token(old_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
            RefreshToken.expires_at > datetime.now(timezone.utc),
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
    await db.refresh(user)
    return user


async def create_audit_log(
    db: AsyncSession,
    user_id: Optional[uuid.UUID],
    entity_type: str,
    entity_id: str,
    action: str,
    changes_json: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    user_email: Optional[str] = None,
    outcome: str = "success",
):
    from app.common.audit import ACTION_SEVERITY, compute_integrity_hash

    # Get the previous entry's hash for the chain
    prev_result = await db.execute(select(AuditLog.integrity_hash).order_by(AuditLog.timestamp.desc()).limit(1))
    previous_hash = prev_result.scalar_one_or_none()

    # Determine severity
    severity = ACTION_SEVERITY.get(action, "info")

    # Generate entry ID and timestamp
    entry_id = str(uuid.uuid4())
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()

    # Compute integrity hash (nonrepudiation chain)
    integrity_hash = compute_integrity_hash(
        entry_id,
        now,
        str(user_id) if user_id else None,
        action,
        entity_type,
        str(entity_id),
        changes_json,
        previous_hash,
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
        timestamp=now_dt,
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
