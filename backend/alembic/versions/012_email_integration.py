"""Add email integration tables

Revision ID: 0012
Revises: 0011
Create Date: 2026-02-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create emaildirection enum via raw SQL
    op.execute("CREATE TYPE emaildirection AS ENUM ('inbound', 'outbound')")

    # Filed Emails
    op.create_table(
        "filed_emails",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "matter_id",
            UUID(as_uuid=True),
            sa.ForeignKey("matters.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("filed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "direction",
            ENUM("inbound", "outbound", name="emaildirection", create_type=False),
            nullable=False,
            server_default="inbound",
        ),
        sa.Column("subject", sa.String(1000), nullable=True),
        sa.Column("from_address", sa.String(500), nullable=True),
        sa.Column("to_addresses", sa.JSON(), nullable=True),
        sa.Column("cc_addresses", sa.JSON(), nullable=True),
        sa.Column("bcc_addresses", sa.JSON(), nullable=True),
        sa.Column("date_sent", sa.DateTime(timezone=True), nullable=True),
        sa.Column("body_text", sa.Text(), nullable=True),
        sa.Column("body_html", sa.Text(), nullable=True),
        sa.Column("message_id", sa.String(500), nullable=True, index=True),
        sa.Column("in_reply_to", sa.String(500), nullable=True),
        sa.Column("thread_id", sa.String(500), nullable=True, index=True),
        sa.Column("has_attachments", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("attachment_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("headers_json", sa.JSON(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Email Attachments
    op.create_table(
        "email_attachments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "email_id",
            UUID(as_uuid=True),
            sa.ForeignKey("filed_emails.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(255), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("storage_key", sa.String(1000), nullable=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Email Matter Suggestions
    op.create_table(
        "email_matter_suggestions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email_address", sa.String(255), nullable=False, index=True),
        sa.Column(
            "matter_id",
            UUID(as_uuid=True),
            sa.ForeignKey("matters.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("confidence", sa.Float(), nullable=False, server_default=sa.text("1.0")),
        sa.Column("last_used", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )


def downgrade() -> None:
    op.drop_table("email_matter_suggestions")
    op.drop_table("email_attachments")
    op.drop_table("filed_emails")

    # Drop enum
    op.execute("DROP TYPE IF EXISTS emaildirection")
