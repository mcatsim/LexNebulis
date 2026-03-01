"""Add SSO (SAML 2.0 / OIDC) tables

Revision ID: 0011
Revises: 0010
Create Date: 2026-02-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID

from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ssoprovidertype enum via raw SQL
    op.execute("CREATE TYPE ssoprovidertype AS ENUM ('oidc', 'saml')")

    # SSO Providers
    op.create_table(
        "sso_providers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "provider_type",
            ENUM("oidc", "saml", name="ssoprovidertype", create_type=False),
            nullable=False,
            server_default="oidc",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        # OIDC fields
        sa.Column("client_id", sa.String(500), nullable=True),
        sa.Column("client_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("discovery_url", sa.String(1000), nullable=True),
        sa.Column("authorization_endpoint", sa.String(1000), nullable=True),
        sa.Column("token_endpoint", sa.String(1000), nullable=True),
        sa.Column("userinfo_endpoint", sa.String(1000), nullable=True),
        sa.Column("jwks_uri", sa.String(1000), nullable=True),
        sa.Column("scopes", sa.String(500), nullable=True, server_default="openid email profile"),
        # SAML fields (for future use)
        sa.Column("saml_entity_id", sa.String(1000), nullable=True),
        sa.Column("saml_sso_url", sa.String(1000), nullable=True),
        sa.Column("saml_certificate", sa.Text(), nullable=True),
        # Mapping fields
        sa.Column("email_claim", sa.String(100), nullable=True, server_default="email"),
        sa.Column("name_claim", sa.String(100), nullable=True, server_default="name"),
        sa.Column("role_mapping", sa.JSON(), nullable=True),
        sa.Column("auto_create_users", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("default_role", sa.String(50), nullable=True, server_default="paralegal"),
        # Metadata
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # SSO Sessions
    op.create_table(
        "sso_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "provider_id",
            UUID(as_uuid=True),
            sa.ForeignKey("sso_providers.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("external_id", sa.String(500), nullable=True),
        sa.Column("id_token_claims", sa.JSON(), nullable=True),
        sa.Column("state", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("nonce", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("sso_sessions")
    op.drop_table("sso_providers")

    # Drop enum
    op.execute("DROP TYPE IF EXISTS ssoprovidertype")
