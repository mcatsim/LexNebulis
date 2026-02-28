"""Initial schema - all tables

Revision ID: 001
Revises: None
Create Date: 2026-02-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("role", sa.Enum("admin", "attorney", "paralegal", "billing_clerk", name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("failed_login_attempts", sa.Integer(), default=0, nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Refresh Tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("token_hash", sa.String(255), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("revoked", sa.Boolean(), default=False, nullable=False),
    )

    # Audit Log (with nonrepudiation hash chain)
    op.create_table(
        "audit_log",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("entity_type", sa.String(100), nullable=False, index=True),
        sa.Column("entity_id", sa.String(100), nullable=False, index=True),
        sa.Column("action", sa.String(50), nullable=False, index=True),
        sa.Column("changes_json", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("outcome", sa.String(20), nullable=False, server_default="success"),
        sa.Column("severity", sa.String(20), nullable=False, server_default="info"),
        sa.Column("integrity_hash", sa.String(64), nullable=False, index=True),
        sa.Column("previous_hash", sa.String(64), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
    )

    # System Settings
    op.create_table(
        "system_settings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(255), unique=True, nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("updated_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Client number sequence
    op.execute("CREATE SEQUENCE IF NOT EXISTS client_number_seq START WITH 1001")

    # Clients
    op.create_table(
        "clients",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_number", sa.Integer(), server_default=sa.text("nextval('client_number_seq')"), unique=True),
        sa.Column("client_type", sa.Enum("individual", "organization", name="clienttype"), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=True),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("organization_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True, index=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address_json", sa.dialects.postgresql.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("active", "inactive", "archived", name="clientstatus"), nullable=False),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Contacts
    op.create_table(
        "contacts",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("role", sa.Enum("judge", "witness", "opposing_counsel", "expert", "other", name="contactrole"), nullable=False),
        sa.Column("organization", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True, index=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address_json", sa.dialects.postgresql.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Matter number sequence
    op.execute("CREATE SEQUENCE IF NOT EXISTS matter_number_seq START WITH 10001")

    # Matters
    op.create_table(
        "matters",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("matter_number", sa.Integer(), server_default=sa.text("nextval('matter_number_seq')"), unique=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("client_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False, index=True),
        sa.Column("status", sa.Enum("open", "pending", "closed", "archived", name="matterstatus"), nullable=False),
        sa.Column("litigation_type", sa.Enum(
            "civil", "criminal", "family", "corporate", "real_estate", "immigration",
            "bankruptcy", "tax", "labor", "intellectual_property", "estate_planning",
            "personal_injury", "other", name="litigationtype"
        ), nullable=False),
        sa.Column("jurisdiction", sa.String(255), nullable=True),
        sa.Column("court_name", sa.String(255), nullable=True),
        sa.Column("case_number", sa.String(100), nullable=True),
        sa.Column("date_opened", sa.Date(), server_default=sa.func.current_date(), nullable=False),
        sa.Column("date_closed", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("assigned_attorney_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Matter Contacts (join table)
    op.create_table(
        "matter_contacts",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("matter_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_type", sa.String(100), nullable=False, server_default="related"),
    )

    # Documents
    op.create_table(
        "documents",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("matter_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("uploaded_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("storage_key", sa.String(1000), nullable=False),
        sa.Column("mime_type", sa.String(255), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("version", sa.Integer(), default=1, nullable=False),
        sa.Column("parent_document_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id"), nullable=True),
        sa.Column("tags_json", sa.dialects.postgresql.JSON(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Document Tags
    op.create_table(
        "document_tags",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("color", sa.String(7), server_default="#228BE6", nullable=False),
    )

    # Calendar Events
    op.create_table(
        "calendar_events",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("matter_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("matters.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("event_type", sa.Enum("court_date", "deadline", "filing", "meeting", "reminder", name="eventtype"), nullable=False),
        sa.Column("start_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_datetime", sa.DateTime(timezone=True), nullable=True),
        sa.Column("all_day", sa.Boolean(), default=False, nullable=False),
        sa.Column("location", sa.String(500), nullable=True),
        sa.Column("assigned_to", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("reminder_minutes", sa.Integer(), nullable=True),
        sa.Column("status", sa.Enum("scheduled", "completed", "cancelled", name="eventstatus"), nullable=False),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Invoice number sequence
    op.execute("CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1001")

    # Invoices (must be created before time_entries due to FK)
    op.create_table(
        "invoices",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_number", sa.Integer(), server_default=sa.text("nextval('invoice_number_seq')"), unique=True),
        sa.Column("client_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False, index=True),
        sa.Column("matter_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("matters.id"), nullable=False, index=True),
        sa.Column("issued_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("subtotal_cents", sa.BigInteger(), default=0, nullable=False),
        sa.Column("tax_cents", sa.BigInteger(), default=0, nullable=False),
        sa.Column("total_cents", sa.BigInteger(), default=0, nullable=False),
        sa.Column("status", sa.Enum("draft", "sent", "paid", "overdue", "void", name="invoicestatus"), nullable=False),
        sa.Column("pdf_storage_key", sa.String(1000), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Time Entries
    op.create_table(
        "time_entries",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("matter_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("matters.id"), nullable=False, index=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("billable", sa.Boolean(), default=True, nullable=False),
        sa.Column("rate_cents", sa.Integer(), nullable=False),
        sa.Column("invoice_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Rate Schedules
    op.create_table(
        "rate_schedules",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("matter_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("matters.id"), nullable=True),
        sa.Column("rate_cents", sa.Integer(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
    )

    # Invoice Line Items
    op.create_table(
        "invoice_line_items",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("time_entry_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("time_entries.id"), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), default=1, nullable=False),
        sa.Column("rate_cents", sa.Integer(), nullable=False),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
    )

    # Payments
    op.create_table(
        "payments",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=False, index=True),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("method", sa.Enum("check", "ach", "credit_card", "cash", "other", name="paymentmethod"), nullable=False),
        sa.Column("reference_number", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Trust Accounts
    op.create_table(
        "trust_accounts",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_name", sa.String(255), nullable=False),
        sa.Column("bank_name", sa.String(255), nullable=False),
        sa.Column("account_number_encrypted", sa.String(500), nullable=False),
        sa.Column("routing_number_encrypted", sa.String(500), nullable=False),
        sa.Column("balance_cents", sa.BigInteger(), default=0, nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Trust Ledger Entries
    op.create_table(
        "trust_ledger_entries",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trust_account_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("trust_accounts.id"), nullable=False, index=True),
        sa.Column("client_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id"), nullable=False, index=True),
        sa.Column("matter_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("matters.id"), nullable=True),
        sa.Column("entry_type", sa.Enum("deposit", "disbursement", "transfer", name="trustentrytype"), nullable=False),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("running_balance_cents", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("reference_number", sa.String(255), nullable=True),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("created_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Trust Reconciliations
    op.create_table(
        "trust_reconciliations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trust_account_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("trust_accounts.id"), nullable=False),
        sa.Column("reconciliation_date", sa.Date(), nullable=False),
        sa.Column("statement_balance_cents", sa.BigInteger(), nullable=False),
        sa.Column("ledger_balance_cents", sa.BigInteger(), nullable=False),
        sa.Column("is_balanced", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("performed_by", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("trust_reconciliations")
    op.drop_table("trust_ledger_entries")
    op.drop_table("trust_accounts")
    op.drop_table("payments")
    op.drop_table("invoice_line_items")
    op.drop_table("rate_schedules")
    op.drop_table("time_entries")
    op.drop_table("invoices")
    op.drop_table("calendar_events")
    op.drop_table("document_tags")
    op.drop_table("documents")
    op.drop_table("matter_contacts")
    op.drop_table("matters")
    op.drop_table("contacts")
    op.drop_table("clients")
    op.drop_table("system_settings")
    op.drop_table("audit_log")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
    op.execute("DROP SEQUENCE IF EXISTS client_number_seq")
    op.execute("DROP SEQUENCE IF EXISTS matter_number_seq")
    op.execute("DROP SEQUENCE IF EXISTS invoice_number_seq")
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS clienttype")
    op.execute("DROP TYPE IF EXISTS clientstatus")
    op.execute("DROP TYPE IF EXISTS contactrole")
    op.execute("DROP TYPE IF EXISTS matterstatus")
    op.execute("DROP TYPE IF EXISTS litigationtype")
    op.execute("DROP TYPE IF EXISTS eventtype")
    op.execute("DROP TYPE IF EXISTS eventstatus")
    op.execute("DROP TYPE IF EXISTS invoicestatus")
    op.execute("DROP TYPE IF EXISTS paymentmethod")
    op.execute("DROP TYPE IF EXISTS trustentrytype")
