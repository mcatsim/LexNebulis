import csv
import io
from datetime import date
from enum import Enum
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.database import get_db
from app.dependencies import require_roles
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
from app.reports.service import (
    get_aged_receivables,
    get_billable_hours_by_area,
    get_collection_report,
    get_dashboard_summary,
    get_matter_profitability,
    get_realization_report,
    get_revenue_by_attorney,
    get_utilization_report,
)

router = APIRouter()

ALLOWED_ROLES = ("admin", "attorney", "billing_clerk")


class ReportType(str, Enum):
    utilization = "utilization"
    collection = "collection"
    revenue = "revenue"
    aged_receivables = "aged-receivables"
    matter_profitability = "matter-profitability"
    billable_hours = "billable-hours"


@router.get("/summary", response_model=DashboardSummary)
async def report_summary(
    start_date: date,
    end_date: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALLOWED_ROLES))],
):
    return await get_dashboard_summary(db, start_date, end_date)


@router.get("/utilization", response_model=list[UtilizationReport])
async def report_utilization(
    start_date: date,
    end_date: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALLOWED_ROLES))],
):
    return await get_utilization_report(db, start_date, end_date)


@router.get("/realization", response_model=RealizationReport)
async def report_realization(
    start_date: date,
    end_date: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALLOWED_ROLES))],
):
    return await get_realization_report(db, start_date, end_date)


@router.get("/collection", response_model=CollectionReport)
async def report_collection(
    start_date: date,
    end_date: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALLOWED_ROLES))],
):
    return await get_collection_report(db, start_date, end_date)


@router.get("/revenue-by-attorney", response_model=list[RevenueByAttorney])
async def report_revenue_by_attorney(
    start_date: date,
    end_date: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALLOWED_ROLES))],
):
    return await get_revenue_by_attorney(db, start_date, end_date)


@router.get("/aged-receivables", response_model=list[AgedReceivable])
async def report_aged_receivables(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALLOWED_ROLES))],
):
    return await get_aged_receivables(db)


@router.get("/matter-profitability", response_model=list[MatterProfitability])
async def report_matter_profitability(
    start_date: date,
    end_date: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALLOWED_ROLES))],
    limit: int = 50,
):
    return await get_matter_profitability(db, start_date, end_date, limit)


@router.get("/billable-hours", response_model=list[BillableHoursSummary])
async def report_billable_hours(
    start_date: date,
    end_date: date,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALLOWED_ROLES))],
):
    return await get_billable_hours_by_area(db, start_date, end_date)


@router.get("/export/{report_type}")
async def export_report(
    report_type: ReportType,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(*ALLOWED_ROLES))],
    start_date: date | None = None,
    end_date: date | None = None,
):
    # Validate date range for reports that need it
    needs_dates = report_type != ReportType.aged_receivables
    if needs_dates and (start_date is None or end_date is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date and end_date are required for this report type",
        )

    # Generate report data
    rows: list[dict] = []

    if report_type == ReportType.utilization:
        data = await get_utilization_report(db, start_date, end_date)
        rows = [item.model_dump() for item in data]
    elif report_type == ReportType.collection:
        data = await get_collection_report(db, start_date, end_date)
        rows = [data.model_dump()]
    elif report_type == ReportType.revenue:
        data = await get_revenue_by_attorney(db, start_date, end_date)
        rows = [item.model_dump() for item in data]
    elif report_type == ReportType.aged_receivables:
        data = await get_aged_receivables(db)
        rows = [item.model_dump() for item in data]
    elif report_type == ReportType.matter_profitability:
        data = await get_matter_profitability(db, start_date, end_date)
        rows = [item.model_dump() for item in data]
    elif report_type == ReportType.billable_hours:
        data = await get_billable_hours_by_area(db, start_date, end_date)
        rows = [item.model_dump() for item in data]

    if not rows:
        rows = [{"message": "No data available"}]

    # Generate CSV
    output = io.StringIO()
    fieldnames = list(rows[0].keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        # Convert date objects to strings for CSV
        writer.writerow({k: str(v) if isinstance(v, date) else v for k, v in row.items()})

    output.seek(0)
    filename = f"{report_type.value}-report.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
