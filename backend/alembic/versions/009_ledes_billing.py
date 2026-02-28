"""Add LEDES billing / e-billing tables

Revision ID: 0009
Revises: 0008
Create Date: 2026-02-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create utbmscodetype enum via raw SQL
    op.execute("CREATE TYPE utbmscodetype AS ENUM ('activity', 'expense', 'task', 'phase')")

    # UTBMS Codes
    op.create_table(
        "utbms_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True, index=True),
        sa.Column(
            "code_type",
            ENUM("activity", "expense", "task", "phase", name="utbmscodetype", create_type=False),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("practice_area", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    # Billing Guidelines
    op.create_table(
        "billing_guidelines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("rate_cap_cents", sa.Integer(), nullable=True),
        sa.Column("daily_hour_cap", sa.Float(), nullable=True),
        sa.Column("block_billing_prohibited", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("task_code_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("activity_code_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("restricted_codes", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Time Entry Codes (linking table)
    op.create_table(
        "time_entry_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "time_entry_id",
            UUID(as_uuid=True),
            sa.ForeignKey("time_entries.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "utbms_code_id",
            UUID(as_uuid=True),
            sa.ForeignKey("utbms_codes.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("time_entry_codes")
    op.drop_table("billing_guidelines")
    op.drop_table("utbms_codes")

    # Drop enum
    op.execute("DROP TYPE IF EXISTS utbmscodetype")
