import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# Import all models so they register with Base.metadata
from app.database import Base
from app.auth.models import User, RefreshToken, AuditLog, SystemSetting  # noqa: F401
from app.clients.models import Client  # noqa: F401
from app.contacts.models import Contact  # noqa: F401
from app.matters.models import Matter, MatterContact  # noqa: F401
from app.documents.models import Document, DocumentTag  # noqa: F401
from app.calendar.models import CalendarEvent  # noqa: F401
from app.billing.models import TimeEntry, RateSchedule, Invoice, InvoiceLineItem, Payment  # noqa: F401
from app.trust.models import TrustAccount, TrustLedgerEntry, TrustReconciliation  # noqa: F401
from app.portal.models import ClientUser, Message, SharedDocument  # noqa: F401
from app.templates.models import DocumentTemplate, GeneratedDocument  # noqa: F401
from app.intake.models import Lead, IntakeForm, IntakeSubmission  # noqa: F401
from app.ledes.models import UTBMSCode, BillingGuideline, TimeEntryCode  # noqa: F401
from app.esign.models import SignatureRequest, Signer, SignatureAuditEntry  # noqa: F401
from app.emails.models import FiledEmail, EmailAttachment, EmailMatterSuggestion  # noqa: F401
from app.sso.models import SSOProvider, SSOSession  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override URL from environment if available
database_url = os.environ.get("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
