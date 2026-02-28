"""Conflict checking - conflict_checks, conflict_matches, ethical_walls

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Conflict Checks ──────────────────────────────────────────────
    op.create_table(
        "conflict_checks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "checked_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("search_name", sa.String(255), nullable=False),
        sa.Column("search_organization", sa.String(255), nullable=True),
        sa.Column(
            "matter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("matters.id"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "status",
            sa.Enum("clear", "potential_conflict", "confirmed_conflict", name="conflictstatus"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Conflict Matches ─────────────────────────────────────────────
    op.create_table(
        "conflict_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conflict_check_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conflict_checks.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("matched_entity_type", sa.String(50), nullable=False),
        sa.Column("matched_entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("matched_name", sa.String(500), nullable=False),
        sa.Column(
            "match_type",
            sa.Enum("exact", "fuzzy", "phonetic", "email", name="matchtype"),
            nullable=False,
        ),
        sa.Column("match_score", sa.Float(), nullable=False),
        sa.Column("relationship_context", sa.String(500), nullable=True),
        sa.Column(
            "resolution",
            sa.Enum("not_reviewed", "cleared", "flagged", "waiver_obtained", name="matchresolution"),
            nullable=False,
            server_default="not_reviewed",
        ),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    # ── Ethical Walls ────────────────────────────────────────────────
    op.create_table(
        "ethical_walls",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "matter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("matters.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ethical_walls")
    op.drop_table("conflict_matches")
    op.drop_table("conflict_checks")

    op.execute("DROP TYPE IF EXISTS matchresolution")
    op.execute("DROP TYPE IF EXISTS matchtype")
    op.execute("DROP TYPE IF EXISTS conflictstatus")
