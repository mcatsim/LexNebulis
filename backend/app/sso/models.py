import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class SSOProviderType(str, enum.Enum):
    oidc = "oidc"
    saml = "saml"


class SSOProvider(UUIDBase, TimestampMixin):
    __tablename__ = "sso_providers"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_type: Mapped[SSOProviderType] = mapped_column(
        Enum(SSOProviderType, name="ssoprovidertype"), nullable=False, default=SSOProviderType.oidc
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # OIDC fields
    client_id: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    client_secret_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    discovery_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    authorization_endpoint: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    token_endpoint: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    userinfo_endpoint: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    jwks_uri: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    scopes: Mapped[Optional[str]] = mapped_column(String(500), default="openid email profile", nullable=True)

    # SAML fields (for future use)
    saml_entity_id: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    saml_sso_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    saml_certificate: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Mapping fields
    email_claim: Mapped[Optional[str]] = mapped_column(String(100), default="email", nullable=True)
    name_claim: Mapped[Optional[str]] = mapped_column(String(100), default="name", nullable=True)
    role_mapping: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    auto_create_users: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    default_role: Mapped[Optional[str]] = mapped_column(String(50), default="paralegal", nullable=True)

    # Created by
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), ForeignKey("users.id"), nullable=True)


class SSOSession(UUIDBase):
    __tablename__ = "sso_sessions"

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sso_providers.id"), nullable=False, index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    id_token_claims: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    state: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    nonce: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
