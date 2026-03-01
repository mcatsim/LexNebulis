"""Add accounting integration tables

Revision ID: 0014
Revises: 0013
Create Date: 2026-02-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID

from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums via raw SQL
    op.execute("CREATE TYPE exportformat AS ENUM ('iif', 'csv', 'qbo_json')")
    op.execute("CREATE TYPE accounttype AS ENUM ('income', 'expense', 'asset', 'liability', 'equity')")

    # Chart of Accounts
    op.create_table(
        "chart_of_accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "account_type",
            ENUM("income", "expense", "asset", "liability", "equity", name="accounttype", create_type=False),
            nullable=False,
            index=True,
        ),
        sa.Column("parent_code", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("quickbooks_account_name", sa.String(255), nullable=True),
        sa.Column("xero_account_code", sa.String(50), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Account Mappings
    op.create_table(
        "account_mappings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source_type", sa.String(100), nullable=False, index=True),
        sa.Column(
            "account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("chart_of_accounts.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Export History
    op.create_table(
        "export_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "export_format",
            ENUM("iif", "csv", "qbo_json", name="exportformat", create_type=False),
            nullable=False,
        ),
        sa.Column("export_type", sa.String(100), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("record_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("file_name", sa.String(500), nullable=True),
        sa.Column("storage_key", sa.String(1000), nullable=True),
        sa.Column("exported_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("export_history")
    op.drop_table("account_mappings")
    op.drop_table("chart_of_accounts")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS exportformat")
    op.execute("DROP TYPE IF EXISTS accounttype")
