"""Add client portal tables: client_users, messages, shared_documents

Revision ID: 0005
Revises: 0004
Create Date: 2026-02-28
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM, UUID

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sender_type enum via raw SQL (avoids async bridge issues with checkfirst)
    op.execute("CREATE TYPE sendertype AS ENUM ('staff', 'client')")

    # ── client_users table ────────────────────────────────────────────
    op.create_table(
        "client_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False, index=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── messages table ────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("matter_id", UUID(as_uuid=True), sa.ForeignKey("matters.id"), nullable=False, index=True),
        sa.Column("sender_type", ENUM("staff", "client", name="sendertype", create_type=False), nullable=False),
        sa.Column("sender_staff_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("sender_client_user_id", UUID(as_uuid=True), sa.ForeignKey("client_users.id"), nullable=True),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("parent_message_id", UUID(as_uuid=True), sa.ForeignKey("messages.id"), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_messages_sender_type", "messages", ["sender_type"])
    op.create_index("ix_messages_is_read", "messages", ["is_read"])

    # ── shared_documents table ────────────────────────────────────────
    op.create_table(
        "shared_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id"), nullable=False, index=True),
        sa.Column("matter_id", UUID(as_uuid=True), sa.ForeignKey("matters.id"), nullable=False, index=True),
        sa.Column("shared_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("shared_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("shared_documents")
    op.drop_index("ix_messages_is_read", table_name="messages")
    op.drop_index("ix_messages_sender_type", table_name="messages")
    op.drop_table("messages")
    op.drop_table("client_users")
    op.execute("DROP TYPE IF EXISTS sendertype")
