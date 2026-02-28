"""Add deadline calendaring tables

Revision ID: 0007
Revises: 0006
Create Date: 2026-02-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create offsettype enum via raw SQL
    op.execute("CREATE TYPE offsettype AS ENUM ('calendar_days', 'business_days')")

    # Court Rule Sets
    op.create_table(
        "court_rule_sets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("jurisdiction", sa.String(255), nullable=False, index=True),
        sa.Column("court_type", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Deadline Rules
    op.create_table(
        "deadline_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("rule_set_id", UUID(as_uuid=True), sa.ForeignKey("court_rule_sets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("trigger_event", sa.String(255), nullable=False, index=True),
        sa.Column("offset_days", sa.Integer(), nullable=False),
        sa.Column("offset_type", ENUM("calendar_days", "business_days", name="offsettype", create_type=False), nullable=False, server_default="calendar_days"),
        sa.Column("creates_event_type", sa.String(100), nullable=False, server_default="deadline"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    # Matter Deadline Configs
    op.create_table(
        "matter_deadline_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("matter_id", UUID(as_uuid=True), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("rule_set_id", UUID(as_uuid=True), sa.ForeignKey("court_rule_sets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Trigger Events
    op.create_table(
        "trigger_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("matter_id", UUID(as_uuid=True), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("trigger_name", sa.String(255), nullable=False, index=True),
        sa.Column("trigger_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Generated Deadlines
    op.create_table(
        "generated_deadlines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("calendar_event_id", UUID(as_uuid=True), sa.ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("trigger_event_id", UUID(as_uuid=True), sa.ForeignKey("trigger_events.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("deadline_rule_id", UUID(as_uuid=True), sa.ForeignKey("deadline_rules.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("matter_id", UUID(as_uuid=True), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("computed_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Statutes of Limitations
    op.create_table(
        "statutes_of_limitations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("matter_id", UUID(as_uuid=True), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("expiration_date", sa.Date(), nullable=False, index=True),
        sa.Column("statute_reference", sa.String(255), nullable=True),
        sa.Column("reminder_days", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("statutes_of_limitations")
    op.drop_table("generated_deadlines")
    op.drop_table("trigger_events")
    op.drop_table("matter_deadline_configs")
    op.drop_table("deadline_rules")
    op.drop_table("court_rule_sets")

    # Drop enum
    op.execute("DROP TYPE IF EXISTS offsettype")
