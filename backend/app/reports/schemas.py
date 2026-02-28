from datetime import date

from pydantic import BaseModel


class DateRangeParams(BaseModel):
    start_date: date
    end_date: date


class UtilizationReport(BaseModel):
    user_id: str
    user_name: str
    total_hours: float
    billable_hours: float
    non_billable_hours: float
    utilization_rate: float  # billable / total as percentage


class RealizationReport(BaseModel):
    total_billed_cents: int
    total_collected_cents: int
    realization_rate: float  # collected / billed as percentage
    period_start: date
    period_end: date


class CollectionReport(BaseModel):
    total_invoiced_cents: int
    total_collected_cents: int
    total_outstanding_cents: int
    collection_rate: float  # collected / invoiced as percentage
    period_start: date
    period_end: date


class RevenueByAttorney(BaseModel):
    user_id: str
    user_name: str
    billed_cents: int
    collected_cents: int
    hours_worked: float
    effective_rate_cents: int  # collected / hours


class AgedReceivable(BaseModel):
    client_id: str
    client_name: str
    current_cents: int  # 0-30 days
    days_31_60_cents: int
    days_61_90_cents: int
    days_91_120_cents: int
    over_120_cents: int
    total_cents: int


class MatterProfitability(BaseModel):
    matter_id: str
    matter_title: str
    client_name: str
    total_billed_cents: int
    total_collected_cents: int
    total_hours: float
    effective_rate_cents: int
    status: str


class BillableHoursSummary(BaseModel):
    user_id: str
    user_name: str
    practice_area: str
    billable_hours: float
    billable_amount_cents: int


class DashboardSummary(BaseModel):
    total_revenue_cents: int
    total_outstanding_cents: int
    total_wip_cents: int  # unbilled time
    total_matters_open: int
    total_matters_closed_period: int
    average_collection_days: float
    utilization_rate: float
    collection_rate: float


class ReportExportRow(BaseModel):
    """Generic row for CSV export"""

    data: dict
