"""Add document templates and generated documents tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-02-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create templatecategory enum type
    op.execute(
        "CREATE TYPE templatecategory AS ENUM "
        "('engagement_letter', 'correspondence', 'pleading', 'motion', 'contract', 'discovery', 'other')"
    )

    # Create document_templates table
    op.create_table(
        "document_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("practice_area", sa.String(100), nullable=True),
        sa.Column(
            "category",
            ENUM(
                "engagement_letter",
                "correspondence",
                "pleading",
                "motion",
                "contract",
                "discovery",
                "other",
                name="templatecategory",
                create_type=False,
            ),
            nullable=False,
            server_default="other",
        ),
        sa.Column("storage_key", sa.String(1000), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Create generated_documents table
    op.create_table(
        "generated_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "template_id",
            UUID(as_uuid=True),
            sa.ForeignKey("document_templates.id", ondelete="CASCADE"),
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
        sa.Column(
            "document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("generated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("context_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("generated_documents")
    op.drop_table("document_templates")
    op.execute("DROP TYPE IF EXISTS templatecategory")
