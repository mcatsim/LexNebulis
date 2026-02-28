from datetime import date

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.billing.models import Invoice, InvoiceStatus, Payment, TimeEntry
from app.clients.models import Client
from app.matters.models import Matter, MatterStatus
from app.reports.schemas import (
    AgedReceivable,
    BillableHoursSummary,
    CollectionReport,
    DashboardSummary,
    MatterProfitability,
    RealizationReport,
    RevenueByAttorney,
    UtilizationReport,
)


async def get_dashboard_summary(db: AsyncSession, start_date: date, end_date: date) -> DashboardSummary:
    # Total revenue = sum of payments in period
    rev_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date,
        )
    )
    total_revenue_cents = rev_result.scalar_one()

    # Outstanding = sum of invoice.total_cents where status in (sent, overdue)
    out_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total_cents), 0)).where(
            Invoice.status.in_([InvoiceStatus.sent, InvoiceStatus.overdue])
        )
    )
    total_outstanding_cents = out_result.scalar_one()

    # WIP = sum of (duration_minutes / 60 * rate_cents) for unbilled time entries (invoice_id is None)
    wip_result = await db.execute(
        select(
            func.coalesce(
                func.sum((TimeEntry.duration_minutes * TimeEntry.rate_cents) / 60),
                0,
            )
        ).where(
            TimeEntry.invoice_id.is_(None),
            TimeEntry.billable.is_(True),
        )
    )
    total_wip_cents = int(wip_result.scalar_one())

    # Matters open
    open_result = await db.execute(select(func.count(Matter.id)).where(Matter.status == MatterStatus.open))
    total_matters_open = open_result.scalar_one()

    # Matters closed in period
    closed_result = await db.execute(
        select(func.count(Matter.id)).where(
            Matter.date_closed >= start_date,
            Matter.date_closed <= end_date,
        )
    )
    total_matters_closed_period = closed_result.scalar_one()

    # Average collection days = avg(payment_date - invoice.issued_date) for invoices paid in period
    avg_days_result = await db.execute(
        select(
            func.avg(
                func.extract("epoch", func.cast(Payment.payment_date, Invoice.issued_date.type))
                - func.extract("epoch", func.cast(Invoice.issued_date, Invoice.issued_date.type))
            )
            / 86400
        )
        .select_from(Payment)
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .where(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date,
            Invoice.issued_date.is_not(None),
        )
    )
    avg_days_raw = avg_days_result.scalar_one()
    average_collection_days = round(float(avg_days_raw), 1) if avg_days_raw else 0.0

    # Utilization rate = total billable hours / total hours in period
    util_result = await db.execute(
        select(
            func.coalesce(func.sum(TimeEntry.duration_minutes), 0),
            func.coalesce(
                func.sum(case((TimeEntry.billable.is_(True), TimeEntry.duration_minutes), else_=0)),
                0,
            ),
        ).where(
            TimeEntry.date >= start_date,
            TimeEntry.date <= end_date,
        )
    )
    total_minutes, billable_minutes = util_result.one()
    utilization_rate = round((billable_minutes / total_minutes * 100), 1) if total_minutes > 0 else 0.0

    # Collection rate = total collected / total invoiced in period
    inv_total_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total_cents), 0)).where(
            Invoice.issued_date >= start_date,
            Invoice.issued_date <= end_date,
        )
    )
    total_invoiced = inv_total_result.scalar_one()
    collection_rate = round((total_revenue_cents / total_invoiced * 100), 1) if total_invoiced > 0 else 0.0

    return DashboardSummary(
        total_revenue_cents=total_revenue_cents,
        total_outstanding_cents=total_outstanding_cents,
        total_wip_cents=total_wip_cents,
        total_matters_open=total_matters_open,
        total_matters_closed_period=total_matters_closed_period,
        average_collection_days=average_collection_days,
        utilization_rate=utilization_rate,
        collection_rate=collection_rate,
    )


async def get_utilization_report(db: AsyncSession, start_date: date, end_date: date) -> list[UtilizationReport]:
    result = await db.execute(
        select(
            TimeEntry.user_id,
            func.concat(User.first_name, " ", User.last_name).label("user_name"),
            func.sum(TimeEntry.duration_minutes).label("total_minutes"),
            func.sum(case((TimeEntry.billable.is_(True), TimeEntry.duration_minutes), else_=0)).label(
                "billable_minutes"
            ),
            func.sum(case((TimeEntry.billable.is_(False), TimeEntry.duration_minutes), else_=0)).label(
                "non_billable_minutes"
            ),
        )
        .join(User, TimeEntry.user_id == User.id)
        .where(
            TimeEntry.date >= start_date,
            TimeEntry.date <= end_date,
        )
        .group_by(TimeEntry.user_id, User.first_name, User.last_name)
        .order_by(func.sum(TimeEntry.duration_minutes).desc())
    )

    reports = []
    for row in result.all():
        total_hours = round(row.total_minutes / 60, 1)
        billable_hours = round(row.billable_minutes / 60, 1)
        non_billable_hours = round(row.non_billable_minutes / 60, 1)
        utilization_rate = round((row.billable_minutes / row.total_minutes * 100), 1) if row.total_minutes > 0 else 0.0
        reports.append(
            UtilizationReport(
                user_id=str(row.user_id),
                user_name=row.user_name,
                total_hours=total_hours,
                billable_hours=billable_hours,
                non_billable_hours=non_billable_hours,
                utilization_rate=utilization_rate,
            )
        )
    return reports


async def get_realization_report(db: AsyncSession, start_date: date, end_date: date) -> RealizationReport:
    # Billed = sum invoice.total_cents where issued_date in period
    billed_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total_cents), 0)).where(
            Invoice.issued_date >= start_date,
            Invoice.issued_date <= end_date,
        )
    )
    total_billed_cents = billed_result.scalar_one()

    # Collected = sum payments where payment_date in period
    collected_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date,
        )
    )
    total_collected_cents = collected_result.scalar_one()

    realization_rate = round((total_collected_cents / total_billed_cents * 100), 1) if total_billed_cents > 0 else 0.0

    return RealizationReport(
        total_billed_cents=total_billed_cents,
        total_collected_cents=total_collected_cents,
        realization_rate=realization_rate,
        period_start=start_date,
        period_end=end_date,
    )


async def get_collection_report(db: AsyncSession, start_date: date, end_date: date) -> CollectionReport:
    # Invoiced = sum invoice.total_cents where issued_date in period
    inv_result = await db.execute(
        select(func.coalesce(func.sum(Invoice.total_cents), 0)).where(
            Invoice.issued_date >= start_date,
            Invoice.issued_date <= end_date,
        )
    )
    total_invoiced_cents = inv_result.scalar_one()

    # Collected = sum payments where payment_date in period
    coll_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date,
        )
    )
    total_collected_cents = coll_result.scalar_one()

    total_outstanding_cents = total_invoiced_cents - total_collected_cents
    collection_rate = (
        round((total_collected_cents / total_invoiced_cents * 100), 1) if total_invoiced_cents > 0 else 0.0
    )

    return CollectionReport(
        total_invoiced_cents=total_invoiced_cents,
        total_collected_cents=total_collected_cents,
        total_outstanding_cents=total_outstanding_cents,
        collection_rate=collection_rate,
        period_start=start_date,
        period_end=end_date,
    )


async def get_revenue_by_attorney(db: AsyncSession, start_date: date, end_date: date) -> list[RevenueByAttorney]:
    # Get billed amounts per user via time_entries -> invoices
    billed_query = (
        select(
            TimeEntry.user_id,
            func.concat(User.first_name, " ", User.last_name).label("user_name"),
            func.coalesce(
                func.sum((TimeEntry.duration_minutes * TimeEntry.rate_cents) / 60),
                0,
            ).label("billed_cents"),
            func.coalesce(func.sum(TimeEntry.duration_minutes), 0).label("total_minutes"),
        )
        .join(User, TimeEntry.user_id == User.id)
        .join(Invoice, TimeEntry.invoice_id == Invoice.id)
        .where(
            Invoice.issued_date >= start_date,
            Invoice.issued_date <= end_date,
        )
        .group_by(TimeEntry.user_id, User.first_name, User.last_name)
    )
    billed_result = await db.execute(billed_query)
    billed_rows = {str(row.user_id): row for row in billed_result.all()}

    # Get collected amounts per user via time_entries -> invoices -> payments
    collected_query = (
        select(
            TimeEntry.user_id,
            func.coalesce(func.sum(Payment.amount_cents), 0).label("collected_cents"),
        )
        .select_from(TimeEntry)
        .join(Invoice, TimeEntry.invoice_id == Invoice.id)
        .join(Payment, Payment.invoice_id == Invoice.id)
        .where(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date,
        )
        .group_by(TimeEntry.user_id)
    )
    collected_result = await db.execute(collected_query)
    collected_map = {str(row.user_id): int(row.collected_cents) for row in collected_result.all()}

    reports = []
    for user_id, row in billed_rows.items():
        billed_cents = int(row.billed_cents)
        collected_cents = collected_map.get(user_id, 0)
        hours_worked = round(row.total_minutes / 60, 1)
        effective_rate_cents = int(collected_cents / hours_worked) if hours_worked > 0 else 0
        reports.append(
            RevenueByAttorney(
                user_id=user_id,
                user_name=row.user_name,
                billed_cents=billed_cents,
                collected_cents=collected_cents,
                hours_worked=hours_worked,
                effective_rate_cents=effective_rate_cents,
            )
        )

    reports.sort(key=lambda r: r.collected_cents, reverse=True)
    return reports


async def get_aged_receivables(db: AsyncSession) -> list[AgedReceivable]:
    today = date.today()

    # Get all unpaid invoices with client info
    result = await db.execute(
        select(Invoice, Client)
        .join(Client, Invoice.client_id == Client.id)
        .where(Invoice.status.in_([InvoiceStatus.sent, InvoiceStatus.overdue]))
        .order_by(Invoice.due_date.asc())
    )

    # Get payments for outstanding invoices to calculate remaining balances
    client_buckets: dict[str, dict] = {}

    for invoice, client in result.all():
        client_id = str(client.id)
        if client_id not in client_buckets:
            display_name = client.organization_name or f"{client.first_name or ''} {client.last_name or ''}".strip()
            client_buckets[client_id] = {
                "client_name": display_name,
                "current_cents": 0,
                "days_31_60_cents": 0,
                "days_61_90_cents": 0,
                "days_91_120_cents": 0,
                "over_120_cents": 0,
            }

        # Calculate remaining balance on this invoice
        payments_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(Payment.invoice_id == invoice.id)
        )
        paid = payments_result.scalar_one()
        remaining = invoice.total_cents - paid
        if remaining <= 0:
            continue

        # Determine age bucket from due_date
        due = invoice.due_date or invoice.issued_date or today
        age_days = (today - due).days

        bucket = client_buckets[client_id]
        if age_days <= 30:
            bucket["current_cents"] += remaining
        elif age_days <= 60:
            bucket["days_31_60_cents"] += remaining
        elif age_days <= 90:
            bucket["days_61_90_cents"] += remaining
        elif age_days <= 120:
            bucket["days_91_120_cents"] += remaining
        else:
            bucket["over_120_cents"] += remaining

    reports = []
    for client_id, bucket in client_buckets.items():
        total = (
            bucket["current_cents"]
            + bucket["days_31_60_cents"]
            + bucket["days_61_90_cents"]
            + bucket["days_91_120_cents"]
            + bucket["over_120_cents"]
        )
        if total > 0:
            reports.append(
                AgedReceivable(
                    client_id=client_id,
                    client_name=bucket["client_name"],
                    current_cents=bucket["current_cents"],
                    days_31_60_cents=bucket["days_31_60_cents"],
                    days_61_90_cents=bucket["days_61_90_cents"],
                    days_91_120_cents=bucket["days_91_120_cents"],
                    over_120_cents=bucket["over_120_cents"],
                    total_cents=total,
                )
            )

    reports.sort(key=lambda r: r.total_cents, reverse=True)
    return reports


async def get_matter_profitability(
    db: AsyncSession, start_date: date, end_date: date, limit: int = 50
) -> list[MatterProfitability]:
    # Get matters with time entries in the period
    result = await db.execute(
        select(
            Matter.id,
            Matter.title,
            Matter.status,
            func.concat(
                func.coalesce(Client.organization_name, ""),
                func.coalesce(Client.first_name, ""),
                " ",
                func.coalesce(Client.last_name, ""),
            ).label("client_name"),
            func.coalesce(func.sum(TimeEntry.duration_minutes), 0).label("total_minutes"),
            func.coalesce(
                func.sum((TimeEntry.duration_minutes * TimeEntry.rate_cents) / 60),
                0,
            ).label("total_billed_value"),
        )
        .join(Client, Matter.client_id == Client.id)
        .outerjoin(
            TimeEntry,
            and_(
                TimeEntry.matter_id == Matter.id,
                TimeEntry.date >= start_date,
                TimeEntry.date <= end_date,
            ),
        )
        .group_by(Matter.id, Matter.title, Matter.status, Client.organization_name, Client.first_name, Client.last_name)
        .order_by(func.coalesce(func.sum(TimeEntry.duration_minutes), 0).desc())
        .limit(limit)
    )

    matters_data = result.all()

    # Get collected amounts per matter via invoices -> payments
    collected_query = (
        select(
            Invoice.matter_id,
            func.coalesce(func.sum(Payment.amount_cents), 0).label("collected_cents"),
            func.coalesce(func.sum(Invoice.total_cents), 0).label("billed_cents"),
        )
        .join(Payment, Payment.invoice_id == Invoice.id, isouter=True)
        .where(
            Invoice.issued_date >= start_date,
            Invoice.issued_date <= end_date,
        )
        .group_by(Invoice.matter_id)
    )
    collected_result = await db.execute(collected_query)
    collected_map = {str(row.matter_id): row for row in collected_result.all()}

    reports = []
    for row in matters_data:
        matter_id = str(row.id)
        collected_data = collected_map.get(matter_id)
        total_billed_cents = int(collected_data.billed_cents) if collected_data else 0
        total_collected_cents = int(collected_data.collected_cents) if collected_data else 0
        total_hours = round(row.total_minutes / 60, 1)
        effective_rate_cents = int(total_collected_cents / total_hours) if total_hours > 0 else 0

        client_name = row.client_name.strip() if row.client_name else ""

        reports.append(
            MatterProfitability(
                matter_id=matter_id,
                matter_title=row.title,
                client_name=client_name,
                total_billed_cents=total_billed_cents,
                total_collected_cents=total_collected_cents,
                total_hours=total_hours,
                effective_rate_cents=effective_rate_cents,
                status=row.status.value if hasattr(row.status, "value") else str(row.status),
            )
        )

    return reports


async def get_billable_hours_by_area(db: AsyncSession, start_date: date, end_date: date) -> list[BillableHoursSummary]:
    result = await db.execute(
        select(
            TimeEntry.user_id,
            func.concat(User.first_name, " ", User.last_name).label("user_name"),
            Matter.litigation_type.label("practice_area"),
            func.sum(TimeEntry.duration_minutes).label("billable_minutes"),
            func.sum((TimeEntry.duration_minutes * TimeEntry.rate_cents) / 60).label("billable_amount_cents"),
        )
        .join(User, TimeEntry.user_id == User.id)
        .join(Matter, TimeEntry.matter_id == Matter.id)
        .where(
            TimeEntry.date >= start_date,
            TimeEntry.date <= end_date,
            TimeEntry.billable.is_(True),
        )
        .group_by(TimeEntry.user_id, User.first_name, User.last_name, Matter.litigation_type)
        .order_by(func.sum(TimeEntry.duration_minutes).desc())
    )

    reports = []
    for row in result.all():
        practice_area = row.practice_area.value if hasattr(row.practice_area, "value") else str(row.practice_area)
        reports.append(
            BillableHoursSummary(
                user_id=str(row.user_id),
                user_name=row.user_name,
                practice_area=practice_area,
                billable_hours=round(row.billable_minutes / 60, 1),
                billable_amount_cents=int(row.billable_amount_cents),
            )
        )
    return reports
