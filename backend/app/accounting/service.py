import csv
import io
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounting.models import AccountMapping, AccountType, ChartOfAccounts, ExportFormat, ExportHistory
from app.accounting.schemas import (
    AccountMappingCreate,
    AccountMappingResponse,
    AccountMappingUpdate,
    ChartOfAccountsCreate,
    ChartOfAccountsUpdate,
    ExportPreview,
    ExportPreviewRow,
    ExportRequest,
)
from app.billing.models import Invoice, InvoiceStatus, Payment, TimeEntry
from app.trust.models import TrustLedgerEntry

# ---------------------------------------------------------------------------
# Default Law Firm Chart of Accounts
# ---------------------------------------------------------------------------
_LAW_FIRM_DEFAULT_ACCOUNTS: list[dict] = [
    {"code": "4000", "name": "Legal Fees", "account_type": AccountType.income},
    {"code": "4100", "name": "Retainer Income", "account_type": AccountType.income},
    {"code": "4200", "name": "Court Filing Reimbursements", "account_type": AccountType.income},
    {"code": "4300", "name": "Interest Income", "account_type": AccountType.income},
    {"code": "5000", "name": "Salaries & Wages", "account_type": AccountType.expense},
    {"code": "5100", "name": "Office Rent", "account_type": AccountType.expense},
    {"code": "5200", "name": "Office Supplies", "account_type": AccountType.expense},
    {"code": "5300", "name": "Professional Development", "account_type": AccountType.expense},
    {"code": "5400", "name": "Court Filing Fees", "account_type": AccountType.expense},
    {"code": "5500", "name": "Expert Witness Fees", "account_type": AccountType.expense},
    {"code": "5600", "name": "Marketing", "account_type": AccountType.expense},
    {"code": "5700", "name": "Insurance", "account_type": AccountType.expense},
    {"code": "1000", "name": "Operating Account", "account_type": AccountType.asset},
    {"code": "1100", "name": "Trust/IOLTA Account", "account_type": AccountType.asset},
    {"code": "1200", "name": "Accounts Receivable", "account_type": AccountType.asset},
    {"code": "2000", "name": "Accounts Payable", "account_type": AccountType.liability},
    {"code": "2100", "name": "Client Trust Liability", "account_type": AccountType.liability},
    {"code": "3000", "name": "Owner's Equity", "account_type": AccountType.equity},
]

_MINIMAL_CODES = {"4000", "5000", "1000", "1200", "2000", "3000"}


# ---------------------------------------------------------------------------
# Chart of Accounts CRUD
# ---------------------------------------------------------------------------
async def create_account(db: AsyncSession, data: ChartOfAccountsCreate, user_id: uuid.UUID) -> ChartOfAccounts:
    """Create a new chart-of-accounts entry."""
    account = ChartOfAccounts(**data.model_dump(), created_by=user_id)
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


async def update_account(db: AsyncSession, account_id: uuid.UUID, data: ChartOfAccountsUpdate) -> ChartOfAccounts:
    """Update an existing chart-of-accounts entry."""
    result = await db.execute(select(ChartOfAccounts).where(ChartOfAccounts.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise ValueError(f"Account {account_id} not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)

    await db.flush()
    await db.refresh(account)
    return account


async def delete_account(db: AsyncSession, account_id: uuid.UUID) -> None:
    """Delete a chart-of-accounts entry."""
    result = await db.execute(select(ChartOfAccounts).where(ChartOfAccounts.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise ValueError(f"Account {account_id} not found")

    await db.delete(account)
    await db.flush()


async def get_account(db: AsyncSession, account_id: uuid.UUID) -> Optional[ChartOfAccounts]:
    """Return a single account by primary key, or None."""
    result = await db.execute(select(ChartOfAccounts).where(ChartOfAccounts.id == account_id))
    return result.scalar_one_or_none()


async def list_accounts(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 50,
    account_type: Optional[AccountType] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> tuple[list[ChartOfAccounts], int]:
    """Return a paginated, filterable list of accounts and the total count."""
    query = select(ChartOfAccounts)
    count_query = select(func.count(ChartOfAccounts.id))

    if account_type is not None:
        query = query.where(ChartOfAccounts.account_type == account_type)
        count_query = count_query.where(ChartOfAccounts.account_type == account_type)

    if search:
        pattern = f"%{search}%"
        search_filter = (
            ChartOfAccounts.name.ilike(pattern)
            | ChartOfAccounts.code.ilike(pattern)
            | ChartOfAccounts.description.ilike(pattern)
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if is_active is not None:
        query = query.where(ChartOfAccounts.is_active == is_active)
        count_query = count_query.where(ChartOfAccounts.is_active == is_active)

    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(ChartOfAccounts.code.asc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    accounts = list(result.scalars().all())

    return accounts, total


# ---------------------------------------------------------------------------
# Account Mappings CRUD
# ---------------------------------------------------------------------------
async def create_mapping(db: AsyncSession, data: AccountMappingCreate) -> AccountMapping:
    """Create a new account mapping."""
    mapping = AccountMapping(**data.model_dump())
    db.add(mapping)
    await db.flush()
    await db.refresh(mapping)
    return mapping


async def update_mapping(db: AsyncSession, mapping_id: uuid.UUID, data: AccountMappingUpdate) -> AccountMapping:
    """Update an existing account mapping."""
    result = await db.execute(select(AccountMapping).where(AccountMapping.id == mapping_id))
    mapping = result.scalar_one_or_none()
    if mapping is None:
        raise ValueError(f"Mapping {mapping_id} not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(mapping, field, value)

    await db.flush()
    await db.refresh(mapping)
    return mapping


async def delete_mapping(db: AsyncSession, mapping_id: uuid.UUID) -> None:
    """Delete an account mapping."""
    result = await db.execute(select(AccountMapping).where(AccountMapping.id == mapping_id))
    mapping = result.scalar_one_or_none()
    if mapping is None:
        raise ValueError(f"Mapping {mapping_id} not found")

    await db.delete(mapping)
    await db.flush()


async def list_mappings(
    db: AsyncSession,
    account_id: Optional[uuid.UUID] = None,
    source_type: Optional[str] = None,
) -> list[AccountMapping]:
    """Return mappings, optionally filtered by account or source type."""
    query = select(AccountMapping)

    if account_id is not None:
        query = query.where(AccountMapping.account_id == account_id)

    if source_type is not None:
        query = query.where(AccountMapping.source_type == source_type)

    query = query.order_by(AccountMapping.source_type.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def build_mapping_response(mapping: AccountMapping) -> AccountMappingResponse:
    """Enrich a mapping ORM instance with account_name and account_code."""
    account = mapping.account
    return AccountMappingResponse(
        id=mapping.id,
        source_type=mapping.source_type,
        account_id=mapping.account_id,
        description=mapping.description,
        is_default=mapping.is_default,
        created_at=mapping.created_at,
        account_name=account.name if account else None,
        account_code=account.code if account else None,
    )


# ---------------------------------------------------------------------------
# Seed default accounts
# ---------------------------------------------------------------------------
async def seed_default_accounts(db: AsyncSession, template: str, user_id: uuid.UUID) -> list[ChartOfAccounts]:
    """Seed a set of default chart-of-accounts rows for a given template."""
    if template == "law_firm_default":
        seed_data = _LAW_FIRM_DEFAULT_ACCOUNTS
    elif template == "minimal":
        seed_data = [a for a in _LAW_FIRM_DEFAULT_ACCOUNTS if a["code"] in _MINIMAL_CODES]
    else:
        raise ValueError(f"Unknown template: {template}")

    created: list[ChartOfAccounts] = []
    for entry in seed_data:
        # Skip if an account with the same code already exists
        existing = await db.execute(select(ChartOfAccounts).where(ChartOfAccounts.code == entry["code"]))
        if existing.scalar_one_or_none() is not None:
            continue

        account = ChartOfAccounts(
            code=entry["code"],
            name=entry["name"],
            account_type=entry["account_type"],
            is_active=True,
            created_by=user_id,
        )
        db.add(account)
        created.append(account)

    await db.flush()
    for acct in created:
        await db.refresh(acct)

    return created


# ---------------------------------------------------------------------------
# Export helpers
# ---------------------------------------------------------------------------
def _get_client_display_name(invoice: Invoice) -> str:
    """Extract a human-readable client name from an invoice."""
    client = invoice.client
    if client is None:
        return "Unknown"
    if hasattr(client, "organization_name") and client.organization_name:
        return client.organization_name
    first = getattr(client, "first_name", "") or ""
    last = getattr(client, "last_name", "") or ""
    return f"{first} {last}".strip() or "Unknown"


def _format_date_iif(d: date) -> str:
    """Format a date as MM/DD/YYYY for IIF."""
    return d.strftime("%m/%d/%Y")


def _format_money(cents: int) -> str:
    """Format cents as a dollar string."""
    return f"{cents / 100:.2f}"


# ---------------------------------------------------------------------------
# Fetch data for exports
# ---------------------------------------------------------------------------
async def _fetch_invoices(db: AsyncSession, start_date: date, end_date: date) -> list[Invoice]:
    result = await db.execute(
        select(Invoice)
        .where(
            Invoice.issued_date >= start_date,
            Invoice.issued_date <= end_date,
            Invoice.status != InvoiceStatus.void,
        )
        .order_by(Invoice.issued_date.asc(), Invoice.invoice_number.asc())
    )
    return list(result.scalars().all())


async def _fetch_payments(db: AsyncSession, start_date: date, end_date: date) -> list[Payment]:
    result = await db.execute(
        select(Payment)
        .where(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date,
        )
        .order_by(Payment.payment_date.asc())
    )
    return list(result.scalars().all())


async def _fetch_time_entries(db: AsyncSession, start_date: date, end_date: date) -> list[TimeEntry]:
    result = await db.execute(
        select(TimeEntry)
        .where(
            TimeEntry.date >= start_date,
            TimeEntry.date <= end_date,
        )
        .order_by(TimeEntry.date.asc())
    )
    return list(result.scalars().all())


async def _fetch_trust_entries(db: AsyncSession, start_date: date, end_date: date) -> list[TrustLedgerEntry]:
    result = await db.execute(
        select(TrustLedgerEntry)
        .where(
            TrustLedgerEntry.entry_date >= start_date,
            TrustLedgerEntry.entry_date <= end_date,
        )
        .order_by(TrustLedgerEntry.entry_date.asc())
    )
    return list(result.scalars().all())


def _preview_row_from_invoice(inv: Invoice) -> ExportPreviewRow:
    client_name = _get_client_display_name(inv)
    return ExportPreviewRow(
        values={
            "date": str(inv.issued_date) if inv.issued_date else "",
            "invoice_number": str(inv.invoice_number),
            "client": client_name,
            "total": _format_money(inv.total_cents),
            "status": inv.status.value,
        }
    )


def _preview_row_from_payment(pmt: Payment) -> ExportPreviewRow:
    inv = pmt.invoice
    client_name = _get_client_display_name(inv) if inv else ""
    return ExportPreviewRow(
        values={
            "date": str(pmt.payment_date),
            "invoice": str(inv.invoice_number) if inv else "",
            "client": client_name,
            "amount": _format_money(pmt.amount_cents),
            "method": pmt.method.value,
        }
    )


def _preview_row_from_time_entry(entry: TimeEntry) -> ExportPreviewRow:
    amount_cents = int(entry.rate_cents * entry.duration_minutes / 60)
    return ExportPreviewRow(
        values={
            "date": str(entry.date),
            "description": (entry.description[:60] if entry.description else ""),
            "duration_minutes": str(entry.duration_minutes),
            "amount": _format_money(amount_cents),
            "billable": str(entry.billable),
        }
    )


def _preview_row_from_trust_entry(entry: TrustLedgerEntry) -> ExportPreviewRow:
    return ExportPreviewRow(
        values={
            "date": str(entry.entry_date),
            "type": entry.entry_type.value,
            "amount": _format_money(entry.amount_cents),
            "description": (entry.description[:60] if entry.description else ""),
            "reference": entry.reference_number or "",
        }
    )


# ---------------------------------------------------------------------------
# Export Preview
# ---------------------------------------------------------------------------
async def generate_export_preview(db: AsyncSession, data: ExportRequest) -> ExportPreview:
    """Generate a preview of the export with row count and sample rows."""
    export_type = data.export_type
    total_amount_cents = 0
    sample_rows: list[ExportPreviewRow] = []
    row_count = 0

    if export_type == "invoices":
        invoices = await _fetch_invoices(db, data.start_date, data.end_date)
        row_count = len(invoices)
        total_amount_cents = sum(inv.total_cents for inv in invoices)
        for inv in invoices[:10]:
            sample_rows.append(_preview_row_from_invoice(inv))

    elif export_type == "payments":
        payments = await _fetch_payments(db, data.start_date, data.end_date)
        row_count = len(payments)
        total_amount_cents = sum(p.amount_cents for p in payments)
        for pmt in payments[:10]:
            sample_rows.append(_preview_row_from_payment(pmt))

    elif export_type == "time_entries":
        entries = await _fetch_time_entries(db, data.start_date, data.end_date)
        row_count = len(entries)
        total_amount_cents = sum(int(e.rate_cents * e.duration_minutes / 60) for e in entries)
        for entry in entries[:10]:
            sample_rows.append(_preview_row_from_time_entry(entry))

    elif export_type == "trust_transactions":
        entries = await _fetch_trust_entries(db, data.start_date, data.end_date)
        row_count = len(entries)
        total_amount_cents = sum(e.amount_cents for e in entries)
        for entry in entries[:10]:
            sample_rows.append(_preview_row_from_trust_entry(entry))

    return ExportPreview(
        row_count=row_count,
        total_amount_cents=total_amount_cents,
        sample_rows=sample_rows,
        export_type=export_type,
        format=data.format,
    )


# ---------------------------------------------------------------------------
# IIF Export (QuickBooks Desktop)
# ---------------------------------------------------------------------------
async def generate_iif_export(db: AsyncSession, data: ExportRequest, user_id: uuid.UUID) -> str:
    """Generate a QuickBooks IIF (tab-delimited) export and record history."""
    lines: list[str] = []
    # IIF header rows
    lines.append("!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO")
    lines.append("!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO")
    lines.append("!ENDTRNS")

    record_count = 0

    if data.export_type == "invoices":
        invoices = await _fetch_invoices(db, data.start_date, data.end_date)
        record_count = len(invoices)
        for idx, inv in enumerate(invoices, start=1):
            client_name = _get_client_display_name(inv)
            inv_date = _format_date_iif(inv.issued_date) if inv.issued_date else ""
            amount = _format_money(inv.total_cents)
            neg_amount = _format_money(-inv.total_cents)
            memo = f"Invoice #{inv.invoice_number}"

            lines.append(f"TRNS\t{idx}\tINVOICE\t{inv_date}\tAccounts Receivable\t{client_name}\t{amount}\t{memo}")
            spl_memo = "Legal services"
            if inv.line_items:
                desc = inv.line_items[0].description
                spl_memo = desc[:80] if desc else "Legal services"
            lines.append(f"SPL\t{idx}\tINVOICE\t{inv_date}\tLegal Fees\t{client_name}\t{neg_amount}\t{spl_memo}")
            lines.append("ENDTRNS")

    elif data.export_type == "payments":
        payments = await _fetch_payments(db, data.start_date, data.end_date)
        record_count = len(payments)
        for idx, pmt in enumerate(payments, start=1):
            inv = pmt.invoice
            client_name = _get_client_display_name(inv) if inv else ""
            pmt_date = _format_date_iif(pmt.payment_date)
            amount = _format_money(pmt.amount_cents)
            neg_amount = _format_money(-pmt.amount_cents)
            inv_num = inv.invoice_number if inv else "N/A"
            memo = f"Payment for Invoice #{inv_num}"

            lines.append(f"TRNS\t{idx}\tPAYMENT\t{pmt_date}\tOperating Account\t{client_name}\t{amount}\t{memo}")
            lines.append(f"SPL\t{idx}\tPAYMENT\t{pmt_date}\tAccounts Receivable\t{client_name}\t{neg_amount}\t{memo}")
            lines.append("ENDTRNS")

    elif data.export_type == "time_entries":
        entries = await _fetch_time_entries(db, data.start_date, data.end_date)
        record_count = len(entries)
        for idx, entry in enumerate(entries, start=1):
            entry_date = _format_date_iif(entry.date)
            amount_cents = int(entry.rate_cents * entry.duration_minutes / 60)
            amount = _format_money(amount_cents)
            neg_amount = _format_money(-amount_cents)
            desc = entry.description[:80] if entry.description else "Time entry"

            lines.append(f"TRNS\t{idx}\tTIME_ENTRY\t{entry_date}\tAccounts Receivable\t\t{amount}\t{desc}")
            lines.append(f"SPL\t{idx}\tTIME_ENTRY\t{entry_date}\tLegal Fees\t\t{neg_amount}\t{desc}")
            lines.append("ENDTRNS")

    elif data.export_type == "trust_transactions":
        entries = await _fetch_trust_entries(db, data.start_date, data.end_date)
        record_count = len(entries)
        for idx, entry in enumerate(entries, start=1):
            entry_date = _format_date_iif(entry.entry_date)
            amount = _format_money(entry.amount_cents)
            neg_amount = _format_money(-entry.amount_cents)
            client_name = ""
            if entry.client:
                org = getattr(entry.client, "organization_name", None)
                if org:
                    client_name = org
                else:
                    first = getattr(entry.client, "first_name", "") or ""
                    last = getattr(entry.client, "last_name", "") or ""
                    client_name = f"{first} {last}".strip()
            desc = entry.description[:80] if entry.description else "Trust transaction"

            if entry.entry_type.value == "deposit":
                lines.append(
                    f"TRNS\t{idx}\tDEPOSIT\t{entry_date}\tTrust/IOLTA Account\t{client_name}\t{amount}\t{desc}"
                )
                lines.append(
                    f"SPL\t{idx}\tDEPOSIT\t{entry_date}\tClient Trust Liability\t{client_name}\t{neg_amount}\t{desc}"
                )
            elif entry.entry_type.value == "disbursement":
                lines.append(
                    f"TRNS\t{idx}\tDISBURSEMENT\t{entry_date}\tClient Trust Liability\t{client_name}\t{amount}\t{desc}"
                )
                lines.append(
                    f"SPL\t{idx}\tDISBURSEMENT\t{entry_date}\tTrust/IOLTA Account\t{client_name}\t{neg_amount}\t{desc}"
                )
            else:
                lines.append(
                    f"TRNS\t{idx}\tTRANSFER\t{entry_date}\tTrust/IOLTA Account\t{client_name}\t{amount}\t{desc}"
                )
                lines.append(
                    f"SPL\t{idx}\tTRANSFER\t{entry_date}\tClient Trust Liability\t{client_name}\t{neg_amount}\t{desc}"
                )
            lines.append("ENDTRNS")

    content = "\n".join(lines) + "\n"

    # Record export history
    file_name = f"export_{data.export_type}_{data.start_date}_{data.end_date}.iif"
    history = ExportHistory(
        export_format=ExportFormat.iif,
        export_type=data.export_type,
        start_date=data.start_date,
        end_date=data.end_date,
        record_count=record_count,
        file_name=file_name,
        exported_by=user_id,
    )
    db.add(history)
    await db.flush()

    return content


# ---------------------------------------------------------------------------
# CSV Export
# ---------------------------------------------------------------------------
async def generate_csv_export(db: AsyncSession, data: ExportRequest, user_id: uuid.UUID) -> str:
    """Generate a CSV export and record history."""
    output = io.StringIO()
    writer = csv.writer(output)
    record_count = 0

    if data.export_type == "invoices":
        invoices = await _fetch_invoices(db, data.start_date, data.end_date)
        record_count = len(invoices)
        writer.writerow(["Date", "Invoice #", "Client", "Matter", "Subtotal", "Tax", "Total", "Status"])
        for inv in invoices:
            client_name = _get_client_display_name(inv)
            matter_title = inv.matter.title if inv.matter else ""
            writer.writerow(
                [
                    str(inv.issued_date) if inv.issued_date else "",
                    inv.invoice_number,
                    client_name,
                    matter_title,
                    _format_money(inv.subtotal_cents),
                    _format_money(inv.tax_cents),
                    _format_money(inv.total_cents),
                    inv.status.value,
                ]
            )

    elif data.export_type == "payments":
        payments = await _fetch_payments(db, data.start_date, data.end_date)
        record_count = len(payments)
        writer.writerow(["Date", "Invoice #", "Client", "Amount", "Method", "Reference"])
        for pmt in payments:
            inv = pmt.invoice
            client_name = _get_client_display_name(inv) if inv else ""
            inv_number = inv.invoice_number if inv else ""
            writer.writerow(
                [
                    str(pmt.payment_date),
                    inv_number,
                    client_name,
                    _format_money(pmt.amount_cents),
                    pmt.method.value,
                    pmt.reference_number or "",
                ]
            )

    elif data.export_type == "time_entries":
        entries = await _fetch_time_entries(db, data.start_date, data.end_date)
        record_count = len(entries)
        writer.writerow(["Date", "Description", "Duration (min)", "Rate", "Amount", "Billable", "Matter"])
        for entry in entries:
            amount_cents = int(entry.rate_cents * entry.duration_minutes / 60)
            matter_title = entry.matter.title if entry.matter else ""
            writer.writerow(
                [
                    str(entry.date),
                    entry.description,
                    entry.duration_minutes,
                    _format_money(entry.rate_cents),
                    _format_money(amount_cents),
                    str(entry.billable),
                    matter_title,
                ]
            )

    elif data.export_type == "trust_transactions":
        entries = await _fetch_trust_entries(db, data.start_date, data.end_date)
        record_count = len(entries)
        writer.writerow(["Date", "Type", "Client", "Amount", "Running Balance", "Description", "Reference"])
        for entry in entries:
            client_name = ""
            if entry.client:
                org = getattr(entry.client, "organization_name", None)
                if org:
                    client_name = org
                else:
                    first = getattr(entry.client, "first_name", "") or ""
                    last = getattr(entry.client, "last_name", "") or ""
                    client_name = f"{first} {last}".strip()
            writer.writerow(
                [
                    str(entry.entry_date),
                    entry.entry_type.value,
                    client_name,
                    _format_money(entry.amount_cents),
                    _format_money(entry.running_balance_cents),
                    entry.description,
                    entry.reference_number or "",
                ]
            )

    content = output.getvalue()

    # Record export history
    file_name = f"export_{data.export_type}_{data.start_date}_{data.end_date}.csv"
    history = ExportHistory(
        export_format=ExportFormat.csv,
        export_type=data.export_type,
        start_date=data.start_date,
        end_date=data.end_date,
        record_count=record_count,
        file_name=file_name,
        exported_by=user_id,
    )
    db.add(history)
    await db.flush()

    return content


# ---------------------------------------------------------------------------
# QBO JSON Export (simplified QuickBooks Online format)
# ---------------------------------------------------------------------------
async def generate_qbo_json_export(db: AsyncSession, data: ExportRequest, user_id: uuid.UUID) -> dict:
    """Generate a QBO-compatible JSON export and record history."""
    export_data: dict = {
        "export_info": {
            "format": "qbo_json",
            "export_type": data.export_type,
            "start_date": str(data.start_date),
            "end_date": str(data.end_date),
        },
    }
    record_count = 0

    if data.export_type == "invoices":
        invoices = await _fetch_invoices(db, data.start_date, data.end_date)
        record_count = len(invoices)
        export_data["export_info"]["record_count"] = record_count

        qbo_invoices = []
        for inv in invoices:
            client_name = _get_client_display_name(inv)
            matter_title = inv.matter.title if inv.matter else ""

            line_items = []
            for li in inv.line_items or []:
                line_items.append(
                    {
                        "description": li.description,
                        "quantity": li.quantity,
                        "unit_price": li.rate_cents / 100,
                        "amount": li.amount_cents / 100,
                    }
                )

            qbo_invoices.append(
                {
                    "Id": str(inv.id),
                    "DocNumber": str(inv.invoice_number),
                    "TxnDate": str(inv.issued_date) if inv.issued_date else None,
                    "DueDate": str(inv.due_date) if inv.due_date else None,
                    "CustomerRef": {"name": client_name},
                    "MatterReference": matter_title,
                    "TotalAmt": inv.total_cents / 100,
                    "SubTotal": inv.subtotal_cents / 100,
                    "TaxAmt": inv.tax_cents / 100,
                    "Status": inv.status.value,
                    "Line": line_items,
                }
            )
        export_data["invoices"] = qbo_invoices

    elif data.export_type == "payments":
        payments = await _fetch_payments(db, data.start_date, data.end_date)
        record_count = len(payments)
        export_data["export_info"]["record_count"] = record_count

        qbo_payments = []
        for pmt in payments:
            inv = pmt.invoice
            client_name = _get_client_display_name(inv) if inv else ""
            qbo_payments.append(
                {
                    "Id": str(pmt.id),
                    "TxnDate": str(pmt.payment_date),
                    "CustomerRef": {"name": client_name},
                    "InvoiceNumber": str(inv.invoice_number) if inv else None,
                    "TotalAmt": pmt.amount_cents / 100,
                    "PaymentMethod": pmt.method.value,
                    "ReferenceNumber": pmt.reference_number,
                }
            )
        export_data["payments"] = qbo_payments

    elif data.export_type == "time_entries":
        entries = await _fetch_time_entries(db, data.start_date, data.end_date)
        record_count = len(entries)
        export_data["export_info"]["record_count"] = record_count

        qbo_entries = []
        for entry in entries:
            amount_cents = int(entry.rate_cents * entry.duration_minutes / 60)
            matter_title = entry.matter.title if entry.matter else ""
            qbo_entries.append(
                {
                    "Id": str(entry.id),
                    "TxnDate": str(entry.date),
                    "Description": entry.description,
                    "DurationMinutes": entry.duration_minutes,
                    "HourlyRate": entry.rate_cents / 100,
                    "TotalAmt": amount_cents / 100,
                    "Billable": entry.billable,
                    "MatterReference": matter_title,
                }
            )
        export_data["time_entries"] = qbo_entries

    elif data.export_type == "trust_transactions":
        entries = await _fetch_trust_entries(db, data.start_date, data.end_date)
        record_count = len(entries)
        export_data["export_info"]["record_count"] = record_count

        qbo_trust = []
        for entry in entries:
            client_name = ""
            if entry.client:
                org = getattr(entry.client, "organization_name", None)
                if org:
                    client_name = org
                else:
                    first = getattr(entry.client, "first_name", "") or ""
                    last = getattr(entry.client, "last_name", "") or ""
                    client_name = f"{first} {last}".strip()
            qbo_trust.append(
                {
                    "Id": str(entry.id),
                    "TxnDate": str(entry.entry_date),
                    "EntryType": entry.entry_type.value,
                    "CustomerRef": {"name": client_name},
                    "TotalAmt": entry.amount_cents / 100,
                    "RunningBalance": entry.running_balance_cents / 100,
                    "Description": entry.description,
                    "ReferenceNumber": entry.reference_number,
                }
            )
        export_data["trust_transactions"] = qbo_trust

    # Record export history
    file_name = f"export_{data.export_type}_{data.start_date}_{data.end_date}.json"
    history = ExportHistory(
        export_format=ExportFormat.qbo_json,
        export_type=data.export_type,
        start_date=data.start_date,
        end_date=data.end_date,
        record_count=record_count,
        file_name=file_name,
        exported_by=user_id,
    )
    db.add(history)
    await db.flush()

    return export_data


# ---------------------------------------------------------------------------
# Export History
# ---------------------------------------------------------------------------
async def list_export_history(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    export_format: Optional[ExportFormat] = None,
) -> tuple[list[ExportHistory], int]:
    """Return paginated export history, optionally filtered by format."""
    query = select(ExportHistory)
    count_query = select(func.count(ExportHistory.id))

    if export_format is not None:
        query = query.where(ExportHistory.export_format == export_format)
        count_query = count_query.where(ExportHistory.export_format == export_format)

    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(ExportHistory.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    records = list(result.scalars().all())

    return records, total
