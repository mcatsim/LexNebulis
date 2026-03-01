"""Add payment processing tables

Revision ID: 0013
Revises: 0012
Create Date: 2026-02-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID

from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums via raw SQL
    op.execute("CREATE TYPE paymentprocessor AS ENUM ('stripe', 'lawpay', 'manual')")
    op.execute("CREATE TYPE paymentlinkstatus AS ENUM ('active', 'paid', 'expired', 'cancelled')")
    op.execute("CREATE TYPE paymentaccounttype AS ENUM ('operating', 'trust')")

    # Payment Settings
    op.create_table(
        "payment_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "processor",
            ENUM("stripe", "lawpay", "manual", name="paymentprocessor", create_type=False),
            nullable=False,
            server_default="manual",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("webhook_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("publishable_key", sa.String(500), nullable=True),
        sa.Column(
            "account_type",
            ENUM("operating", "trust", name="paymentaccounttype", create_type=False),
            nullable=False,
            server_default="operating",
        ),
        sa.Column("surcharge_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("surcharge_rate", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Payment Links
    op.create_table(
        "payment_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=False, index=True),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False, index=True),
        sa.Column("matter_id", UUID(as_uuid=True), sa.ForeignKey("matters.id"), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column(
            "status",
            ENUM("active", "paid", "expired", "cancelled", name="paymentlinkstatus", create_type=False),
            nullable=False,
            server_default="active",
        ),
        sa.Column("access_token", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column(
            "processor",
            ENUM("stripe", "lawpay", "manual", name="paymentprocessor", create_type=False),
            nullable=False,
        ),
        sa.Column("processor_session_id", sa.String(500), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_amount_cents", sa.BigInteger(), nullable=True),
        sa.Column("surcharge_cents", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("processor_fee_cents", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("payer_email", sa.String(255), nullable=True),
        sa.Column("payer_name", sa.String(255), nullable=True),
        sa.Column("processor_reference", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Webhook Events
    op.create_table(
        "webhook_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "processor",
            ENUM("stripe", "lawpay", "manual", name="paymentprocessor", create_type=False),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(255), nullable=False),
        sa.Column("event_id", sa.String(500), nullable=True, index=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("processed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("webhook_events")
    op.drop_table("payment_links")
    op.drop_table("payment_settings")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS paymentlinkstatus")
    op.execute("DROP TYPE IF EXISTS paymentaccounttype")
    op.execute("DROP TYPE IF EXISTS paymentprocessor")
