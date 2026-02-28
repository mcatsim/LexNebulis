import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.config import settings
from app.database import get_db
from app.dependencies import require_roles
from app.sso.schemas import (
    SSOLoginInitiate,
    SSOLoginInitiateResponse,
    SSOProviderCreate,
    SSOProviderPublicResponse,
    SSOProviderResponse,
    SSOProviderUpdate,
)
from app.sso.service import (
    apply_discovery_to_provider,
    create_sso_provider,
    delete_sso_provider,
    get_default_provider,
    get_sso_provider,
    handle_sso_callback,
    initiate_sso_login,
    list_active_sso_providers,
    list_sso_providers,
    mask_secret,
    test_provider_connection,
    update_sso_provider,
)

router = APIRouter()


def _provider_to_response(provider) -> SSOProviderResponse:
    """Convert an SSOProvider model to its response schema."""
    return SSOProviderResponse(
        id=provider.id,
        name=provider.name,
        provider_type=provider.provider_type,
        is_active=provider.is_active,
        is_default=provider.is_default,
        client_id=provider.client_id,
        client_secret_masked=mask_secret(provider.client_secret_encrypted),
        discovery_url=provider.discovery_url,
        authorization_endpoint=provider.authorization_endpoint,
        token_endpoint=provider.token_endpoint,
        userinfo_endpoint=provider.userinfo_endpoint,
        jwks_uri=provider.jwks_uri,
        scopes=provider.scopes,
        saml_entity_id=provider.saml_entity_id,
        saml_sso_url=provider.saml_sso_url,
        email_claim=provider.email_claim,
        name_claim=provider.name_claim,
        role_mapping=provider.role_mapping,
        auto_create_users=provider.auto_create_users,
        default_role=provider.default_role,
        created_by=provider.created_by,
        created_at=provider.created_at.isoformat() if provider.created_at else None,
        updated_at=provider.updated_at.isoformat() if provider.updated_at else None,
    )


# ── Public Endpoints ─────────────────────────────────────────────────


@router.get("/providers/public", response_model=list[SSOProviderPublicResponse])
async def list_public_providers(db: Annotated[AsyncSession, Depends(get_db)]):
    """List active SSO providers for the login page (public, no auth required)."""
    providers = await list_active_sso_providers(db)
    return [SSOProviderPublicResponse.model_validate(p) for p in providers]


@router.post("/login/initiate", response_model=SSOLoginInitiateResponse)
async def sso_login_initiate(
    data: SSOLoginInitiate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start the SSO login flow. Returns a redirect URL for the IdP."""
    if data.provider_id:
        provider = await get_sso_provider(db, data.provider_id)
    else:
        provider = await get_default_provider(db)

    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSO provider not found. Specify a provider_id or configure a default provider.",
        )

    if not provider.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SSO provider is not active")

    try:
        redirect_url, state = await initiate_sso_login(db, provider)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return SSOLoginInitiateResponse(redirect_url=redirect_url, state=state)


@router.get("/callback")
async def sso_callback(
    code: str,
    state: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Handle the SSO callback from the IdP.

    This endpoint receives the authorization code and state from the IdP,
    exchanges the code for tokens, finds or creates the user, and
    redirects to the frontend callback page with the tokens.
    """
    try:
        user, access_token, refresh_token = await handle_sso_callback(db, code, state)
    except ValueError as e:
        # Redirect to frontend with error
        frontend_base = settings.backend_cors_origins[0] if settings.backend_cors_origins else "http://localhost"
        error_url = f"{frontend_base}/sso/callback?error={str(e)}"
        return RedirectResponse(url=error_url, status_code=302)
    except Exception:
        frontend_base = settings.backend_cors_origins[0] if settings.backend_cors_origins else "http://localhost"
        error_url = f"{frontend_base}/sso/callback?error=Authentication+failed"
        return RedirectResponse(url=error_url, status_code=302)

    await create_audit_log(
        db,
        user.id,
        "user",
        str(user.id),
        "sso_login",
        ip_address=request.client.host if request.client else None,
    )

    # Redirect to frontend callback page with tokens as query params
    frontend_base = settings.backend_cors_origins[0] if settings.backend_cors_origins else "http://localhost"
    callback_url = f"{frontend_base}/sso/callback?access_token={access_token}&refresh_token={refresh_token}"
    return RedirectResponse(url=callback_url, status_code=302)


# ── Admin Endpoints ──────────────────────────────────────────────────


@router.get("/providers", response_model=list[SSOProviderResponse])
async def list_providers(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    """List all SSO providers (admin only)."""
    providers = await list_sso_providers(db)
    return [_provider_to_response(p) for p in providers]


@router.post("/providers", response_model=SSOProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    data: SSOProviderCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    """Create a new SSO provider (admin only)."""
    provider = await create_sso_provider(db, data.model_dump(), created_by=admin.id)

    await create_audit_log(
        db,
        admin.id,
        "sso_provider",
        str(provider.id),
        "create",
        ip_address=request.client.host if request.client else None,
    )

    return _provider_to_response(provider)


@router.get("/providers/{provider_id}", response_model=SSOProviderResponse)
async def get_provider(
    provider_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    """Get an SSO provider detail (admin only)."""
    provider = await get_sso_provider(db, provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO provider not found")
    return _provider_to_response(provider)


@router.put("/providers/{provider_id}", response_model=SSOProviderResponse)
async def update_provider(
    provider_id: uuid.UUID,
    data: SSOProviderUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    """Update an SSO provider (admin only)."""
    provider = await get_sso_provider(db, provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO provider not found")

    provider = await update_sso_provider(db, provider, data.model_dump(exclude_unset=True))

    await create_audit_log(
        db,
        admin.id,
        "sso_provider",
        str(provider.id),
        "update",
        ip_address=request.client.host if request.client else None,
    )

    return _provider_to_response(provider)


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_endpoint(
    provider_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    """Delete an SSO provider (admin only)."""
    provider = await get_sso_provider(db, provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO provider not found")

    await delete_sso_provider(db, provider)

    await create_audit_log(
        db,
        admin.id,
        "sso_provider",
        str(provider.id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )


@router.post("/providers/{provider_id}/discover", response_model=SSOProviderResponse)
async def discover_endpoints(
    provider_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    """Auto-discover OIDC endpoints from the provider's discovery_url (admin only)."""
    provider = await get_sso_provider(db, provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO provider not found")

    try:
        provider = await apply_discovery_to_provider(db, provider)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch discovery document: {e}",
        )

    await create_audit_log(
        db,
        admin.id,
        "sso_provider",
        str(provider.id),
        "discover_endpoints",
        ip_address=request.client.host if request.client else None,
    )

    return _provider_to_response(provider)


@router.post("/providers/{provider_id}/test")
async def test_connection(
    provider_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(require_roles("admin"))],
):
    """Test an SSO provider's connection (admin only)."""
    provider = await get_sso_provider(db, provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO provider not found")

    result = await test_provider_connection(provider)
    return result
