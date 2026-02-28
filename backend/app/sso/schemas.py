import uuid
from typing import Optional

from pydantic import BaseModel, Field

from app.sso.models import SSOProviderType


class SSOProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    provider_type: SSOProviderType = SSOProviderType.oidc
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    discovery_url: Optional[str] = None
    scopes: str = "openid email profile"
    email_claim: str = "email"
    name_claim: str = "name"
    role_mapping: Optional[dict[str, str]] = None
    auto_create_users: bool = True
    default_role: str = "paralegal"
    # SAML fields (stored for future use)
    saml_entity_id: Optional[str] = None
    saml_sso_url: Optional[str] = None
    saml_certificate: Optional[str] = None


class SSOProviderUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    provider_type: Optional[SSOProviderType] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    discovery_url: Optional[str] = None
    authorization_endpoint: Optional[str] = None
    token_endpoint: Optional[str] = None
    userinfo_endpoint: Optional[str] = None
    jwks_uri: Optional[str] = None
    scopes: Optional[str] = None
    email_claim: Optional[str] = None
    name_claim: Optional[str] = None
    role_mapping: Optional[dict[str, str]] = None
    auto_create_users: Optional[bool] = None
    default_role: Optional[str] = None
    # SAML fields (stored for future use)
    saml_entity_id: Optional[str] = None
    saml_sso_url: Optional[str] = None
    saml_certificate: Optional[str] = None


class SSOProviderResponse(BaseModel):
    id: uuid.UUID
    name: str
    provider_type: SSOProviderType
    is_active: bool
    is_default: bool
    client_id: Optional[str] = None
    client_secret_masked: Optional[str] = None
    discovery_url: Optional[str] = None
    authorization_endpoint: Optional[str] = None
    token_endpoint: Optional[str] = None
    userinfo_endpoint: Optional[str] = None
    jwks_uri: Optional[str] = None
    scopes: Optional[str] = None
    saml_entity_id: Optional[str] = None
    saml_sso_url: Optional[str] = None
    email_claim: Optional[str] = None
    name_claim: Optional[str] = None
    role_mapping: Optional[dict[str, str]] = None
    auto_create_users: bool = True
    default_role: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class SSOProviderPublicResponse(BaseModel):
    id: uuid.UUID
    name: str
    provider_type: SSOProviderType

    model_config = {"from_attributes": True}


class SSOLoginInitiate(BaseModel):
    provider_id: Optional[uuid.UUID] = None


class SSOLoginInitiateResponse(BaseModel):
    redirect_url: str
    state: str


class SSOCallbackRequest(BaseModel):
    code: str
    state: str


class SSOCallbackResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Optional[dict[str, str]] = None
