"""Add e-signature tables

Revision ID: 0010
Revises: 0009
Create Date: 2026-02-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums via raw SQL
    op.execute(
        "CREATE TYPE signaturerequeststatus AS ENUM "
        "('draft', 'pending', 'partially_signed', 'completed', 'expired', 'cancelled')"
    )
    op.execute("CREATE TYPE signerstatus AS ENUM ('pending', 'viewed', 'signed', 'declined')")

    # Signature Requests
    op.create_table(
        "signature_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("documents.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "matter_id",
            UUID(as_uuid=True),
            sa.ForeignKey("matters.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "status",
            ENUM(
                "draft",
                "pending",
                "partially_signed",
                "completed",
                "expired",
                "cancelled",
                name="signaturerequeststatus",
                create_type=False,
            ),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("certificate_storage_key", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Signers
    op.create_table(
        "signers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "signature_request_id",
            UUID(as_uuid=True),
            sa.ForeignKey("signature_requests.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(100), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "status",
            ENUM("pending", "viewed", "signed", "declined", name="signerstatus", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("access_token", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_ip", sa.String(45), nullable=True),
        sa.Column("signed_user_agent", sa.String(500), nullable=True),
        sa.Column("decline_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Signature Audit Entries
    op.create_table(
        "signature_audit_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "signature_request_id",
            UUID(as_uuid=True),
            sa.ForeignKey("signature_requests.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "signer_id",
            UUID(as_uuid=True),
            sa.ForeignKey("signers.id"),
            nullable=True,
            index=True,
        ),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("signature_audit_entries")
    op.drop_table("signers")
    op.drop_table("signature_requests")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS signerstatus")
    op.execute("DROP TYPE IF EXISTS signaturerequeststatus")
