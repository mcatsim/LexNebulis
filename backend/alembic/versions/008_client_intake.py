"""Add client intake / CRM pipeline tables

Revision ID: 0008
Revises: 0007
Create Date: 2026-02-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types via raw SQL
    op.execute(
        "CREATE TYPE leadsource AS ENUM "
        "('website', 'referral', 'social_media', 'advertisement', 'walk_in', 'phone', 'other')"
    )
    op.execute(
        "CREATE TYPE pipelinestage AS ENUM "
        "('new', 'contacted', 'qualified', 'proposal_sent', 'retained', 'declined', 'lost')"
    )

    # Leads table
    op.create_table(
        "leads",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=True, index=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("organization", sa.String(255), nullable=True),
        sa.Column(
            "source",
            ENUM("website", "referral", "social_media", "advertisement", "walk_in", "phone", "other",
                 name="leadsource", create_type=False),
            nullable=False,
            server_default="other",
        ),
        sa.Column("source_detail", sa.String(500), nullable=True),
        sa.Column(
            "stage",
            ENUM("new", "contacted", "qualified", "proposal_sent", "retained", "declined", "lost",
                 name="pipelinestage", create_type=False),
            nullable=False,
            server_default="new",
            index=True,
        ),
        sa.Column("practice_area", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("estimated_value_cents", sa.BigInteger(), nullable=True),
        sa.Column("assigned_to", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("converted_client_id", UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=True),
        sa.Column("converted_matter_id", UUID(as_uuid=True), sa.ForeignKey("matters.id"), nullable=True),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("custom_fields", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Intake Forms table
    op.create_table(
        "intake_forms",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("practice_area", sa.String(100), nullable=True),
        sa.Column("fields_json", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Intake Submissions table
    op.create_table(
        "intake_submissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "form_id", UUID(as_uuid=True),
            sa.ForeignKey("intake_forms.id", ondelete="CASCADE"), nullable=False, index=True,
        ),
        sa.Column("lead_id", UUID(as_uuid=True), sa.ForeignKey("leads.id"), nullable=True),
        sa.Column("data_json", sa.JSON(), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("is_reviewed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("reviewed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("intake_submissions")
    op.drop_table("intake_forms")
    op.drop_table("leads")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS pipelinestage")
    op.execute("DROP TYPE IF EXISTS leadsource")
