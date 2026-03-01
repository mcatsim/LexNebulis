"""Add SAML 2.0 SSO fields to sso_providers

Revision ID: 0015
Revises: 0014
Create Date: 2026-02-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sso_providers", sa.Column("saml_sp_entity_id", sa.String(500), nullable=True))
    op.add_column("sso_providers", sa.Column("saml_idp_metadata_url", sa.String(1000), nullable=True))
    op.add_column("sso_providers", sa.Column("saml_idp_metadata_xml", sa.Text(), nullable=True))
    op.add_column(
        "sso_providers",
        sa.Column(
            "saml_name_id_format",
            sa.String(200),
            nullable=True,
            server_default="urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress",
        ),
    )
    op.add_column(
        "sso_providers",
        sa.Column("saml_sign_requests", sa.Boolean(), nullable=True, server_default=sa.text("false")),
    )
    op.add_column("sso_providers", sa.Column("saml_sp_certificate", sa.Text(), nullable=True))
    op.add_column("sso_providers", sa.Column("saml_sp_private_key_encrypted", sa.Text(), nullable=True))
    op.add_column("sso_providers", sa.Column("saml_attribute_mapping", sa.JSON(), nullable=True))
    op.add_column(
        "sso_providers",
        sa.Column("saml_want_assertions_signed", sa.Boolean(), nullable=True, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("sso_providers", "saml_want_assertions_signed")
    op.drop_column("sso_providers", "saml_attribute_mapping")
    op.drop_column("sso_providers", "saml_sp_private_key_encrypted")
    op.drop_column("sso_providers", "saml_sp_certificate")
    op.drop_column("sso_providers", "saml_sign_requests")
    op.drop_column("sso_providers", "saml_name_id_format")
    op.drop_column("sso_providers", "saml_idp_metadata_xml")
    op.drop_column("sso_providers", "saml_idp_metadata_url")
    op.drop_column("sso_providers", "saml_sp_entity_id")
