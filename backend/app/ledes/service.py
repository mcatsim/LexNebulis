import re
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.models import Invoice, InvoiceLineItem, TimeEntry
from app.ledes.models import BillingGuideline, TimeEntryCode, UTBMSCode, UTBMSCodeType
from app.ledes.schemas import (
    BillingGuidelineCreate,
    BillingGuidelineUpdate,
    BlockBillingResponse,
    ComplianceCheckResponse,
    ComplianceViolation,
    UTBMSCodeCreate,
    UTBMSCodeUpdate,
)


# ── UTBMS Code CRUD ──────────────────────────────────────────────────────
async def get_utbms_codes(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    code_type: Optional[UTBMSCodeType] = None,
    practice_area: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> tuple[list[UTBMSCode], int]:
    query = select(UTBMSCode)
    count_query = select(func.count(UTBMSCode.id))

    if code_type:
        query = query.where(UTBMSCode.code_type == code_type)
        count_query = count_query.where(UTBMSCode.code_type == code_type)
    if practice_area:
        query = query.where(UTBMSCode.practice_area == practice_area)
        count_query = count_query.where(UTBMSCode.practice_area == practice_area)
    if search:
        pattern = f"%{search}%"
        query = query.where(UTBMSCode.code.ilike(pattern) | UTBMSCode.name.ilike(pattern))
        count_query = count_query.where(UTBMSCode.code.ilike(pattern) | UTBMSCode.name.ilike(pattern))
    if is_active is not None:
        query = query.where(UTBMSCode.is_active == is_active)
        count_query = count_query.where(UTBMSCode.is_active == is_active)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(UTBMSCode.code).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_utbms_code(db: AsyncSession, code_id: uuid.UUID) -> Optional[UTBMSCode]:
    result = await db.execute(select(UTBMSCode).where(UTBMSCode.id == code_id))
    return result.scalar_one_or_none()


async def create_utbms_code(db: AsyncSession, data: UTBMSCodeCreate) -> UTBMSCode:
    code = UTBMSCode(**data.model_dump())
    db.add(code)
    await db.flush()
    await db.refresh(code)
    return code


async def update_utbms_code(db: AsyncSession, code: UTBMSCode, data: UTBMSCodeUpdate) -> UTBMSCode:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(code, field, value)
    await db.flush()
    await db.refresh(code)
    return code


async def delete_utbms_code(db: AsyncSession, code: UTBMSCode) -> None:
    await db.delete(code)
    await db.flush()


# ── Seed UTBMS Codes ─────────────────────────────────────────────────────
STANDARD_UTBMS_CODES = [
    # Litigation Phase Codes
    {
        "code": "L110",
        "code_type": "phase",
        "name": "Case Assessment, Development and Administration",
        "practice_area": "litigation",
    },
    {"code": "L120", "code_type": "phase", "name": "Pre-Trial Pleadings and Motions", "practice_area": "litigation"},
    {"code": "L130", "code_type": "phase", "name": "Discovery", "practice_area": "litigation"},
    {"code": "L140", "code_type": "phase", "name": "Trial Preparation and Trial", "practice_area": "litigation"},
    {"code": "L150", "code_type": "phase", "name": "Appeal", "practice_area": "litigation"},
    {"code": "L160", "code_type": "phase", "name": "Counseling", "practice_area": "litigation"},
    {"code": "L190", "code_type": "phase", "name": "Other", "practice_area": "litigation"},
    # Litigation Activity Codes
    {"code": "A101", "code_type": "activity", "name": "Plan and prepare for", "practice_area": "litigation"},
    {"code": "A102", "code_type": "activity", "name": "Research", "practice_area": "litigation"},
    {"code": "A103", "code_type": "activity", "name": "Draft/revise", "practice_area": "litigation"},
    {"code": "A104", "code_type": "activity", "name": "Review/analyze", "practice_area": "litigation"},
    {"code": "A105", "code_type": "activity", "name": "Communicate (in firm)", "practice_area": "litigation"},
    {"code": "A106", "code_type": "activity", "name": "Communicate (with client)", "practice_area": "litigation"},
    {
        "code": "A107",
        "code_type": "activity",
        "name": "Communicate (other outside counsel)",
        "practice_area": "litigation",
    },
    {"code": "A108", "code_type": "activity", "name": "Appear for/attend", "practice_area": "litigation"},
    {"code": "A109", "code_type": "activity", "name": "Travel", "practice_area": "litigation"},
    {"code": "A110", "code_type": "activity", "name": "Inspect/review documents", "practice_area": "litigation"},
    # Expense Codes
    {"code": "E101", "code_type": "expense", "name": "Copies/photocopies"},
    {"code": "E102", "code_type": "expense", "name": "Outside printing"},
    {"code": "E103", "code_type": "expense", "name": "Word processing"},
    {"code": "E104", "code_type": "expense", "name": "Facsimile"},
    {"code": "E105", "code_type": "expense", "name": "Telephone"},
    {"code": "E106", "code_type": "expense", "name": "Online research"},
    {"code": "E107", "code_type": "expense", "name": "Delivery services/messengers"},
    {"code": "E108", "code_type": "expense", "name": "Postage"},
    {"code": "E109", "code_type": "expense", "name": "Court fees"},
    {"code": "E110", "code_type": "expense", "name": "Subpoena fees"},
    {"code": "E111", "code_type": "expense", "name": "Witness fees"},
    {"code": "E112", "code_type": "expense", "name": "Court reporter fees"},
    {"code": "E113", "code_type": "expense", "name": "Experts"},
    {"code": "E114", "code_type": "expense", "name": "Investigators"},
    {"code": "E115", "code_type": "expense", "name": "Arbitrators/mediators"},
    {"code": "E116", "code_type": "expense", "name": "Local travel"},
    {"code": "E117", "code_type": "expense", "name": "Out-of-town travel"},
    {"code": "E118", "code_type": "expense", "name": "Meals"},
    {"code": "E119", "code_type": "expense", "name": "Other"},
]


async def seed_utbms_codes(db: AsyncSession) -> int:
    """Seed standard UTBMS codes. Returns count of codes created (skips existing)."""
    created = 0
    for code_data in STANDARD_UTBMS_CODES:
        existing = await db.execute(select(UTBMSCode).where(UTBMSCode.code == code_data["code"]))
        if existing.scalar_one_or_none() is None:
            code = UTBMSCode(**code_data)
            db.add(code)
            created += 1
    await db.flush()
    return created


# ── Billing Guideline CRUD ───────────────────────────────────────────────
async def get_billing_guidelines(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    client_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
) -> tuple[list[BillingGuideline], int]:
    query = select(BillingGuideline)
    count_query = select(func.count(BillingGuideline.id))

    if client_id:
        query = query.where(BillingGuideline.client_id == client_id)
        count_query = count_query.where(BillingGuideline.client_id == client_id)
    if is_active is not None:
        query = query.where(BillingGuideline.is_active == is_active)
        count_query = count_query.where(BillingGuideline.is_active == is_active)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(BillingGuideline.created_at.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_billing_guideline(db: AsyncSession, guideline_id: uuid.UUID) -> Optional[BillingGuideline]:
    result = await db.execute(select(BillingGuideline).where(BillingGuideline.id == guideline_id))
    return result.scalar_one_or_none()


async def create_billing_guideline(
    db: AsyncSession, data: BillingGuidelineCreate, user_id: uuid.UUID
) -> BillingGuideline:
    guideline = BillingGuideline(**data.model_dump(), created_by=user_id)
    db.add(guideline)
    await db.flush()
    await db.refresh(guideline)
    return guideline


async def update_billing_guideline(
    db: AsyncSession, guideline: BillingGuideline, data: BillingGuidelineUpdate
) -> BillingGuideline:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(guideline, field, value)
    await db.flush()
    await db.refresh(guideline)
    return guideline


async def delete_billing_guideline(db: AsyncSession, guideline: BillingGuideline) -> None:
    await db.delete(guideline)
    await db.flush()


# ── Time Entry Code Assignment ───────────────────────────────────────────
async def get_time_entry_codes(db: AsyncSession, time_entry_id: uuid.UUID) -> list[TimeEntryCode]:
    result = await db.execute(
        select(TimeEntryCode).where(TimeEntryCode.time_entry_id == time_entry_id).order_by(TimeEntryCode.created_at)
    )
    return result.scalars().all()


async def assign_code_to_time_entry(
    db: AsyncSession, time_entry_id: uuid.UUID, utbms_code_id: uuid.UUID
) -> TimeEntryCode:
    # Check for duplicate
    existing_result = await db.execute(
        select(TimeEntryCode).where(
            TimeEntryCode.time_entry_id == time_entry_id, TimeEntryCode.utbms_code_id == utbms_code_id
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        return existing

    link = TimeEntryCode(time_entry_id=time_entry_id, utbms_code_id=utbms_code_id)
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return link


async def remove_code_from_time_entry(db: AsyncSession, time_entry_id: uuid.UUID, code_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(TimeEntryCode).where(
            TimeEntryCode.time_entry_id == time_entry_id, TimeEntryCode.utbms_code_id == code_id
        )
    )
    link = result.scalar_one_or_none()
    if link is None:
        return False
    await db.delete(link)
    await db.flush()
    return True


# ── Block Billing Detection ──────────────────────────────────────────────
def detect_block_billing(description: str, duration_minutes: Optional[int] = None) -> BlockBillingResponse:
    """Heuristic check for block billing (lumping multiple tasks into one entry)."""
    reasons: list[str] = []
    description_lower = description.lower().strip()

    # Check for semicolons separating distinct tasks
    semicolons = description.count(";")
    if semicolons >= 1:
        reasons.append(f"Description contains {semicolons} semicolon(s), suggesting multiple tasks lumped together")

    # Check for " and " joining distinct activities (but not at the start of sentence)
    and_pattern = re.compile(r"(?<!\bMr\.)(?<!\bMs\.)(?<!\bDr\.)\band\b", re.IGNORECASE)
    and_matches = and_pattern.findall(description)
    if len(and_matches) >= 2:
        reasons.append("Description contains multiple 'and' conjunctions joining different activities")
    elif len(and_matches) == 1:
        # Check if the 'and' connects verbs/actions (simple heuristic)
        action_verbs = [
            "review",
            "draft",
            "prepare",
            "research",
            "communicate",
            "attend",
            "file",
            "analyze",
            "discuss",
            "revise",
            "confer",
            "telephone",
            "email",
            "meet",
        ]
        parts = re.split(r"\band\b", description_lower)
        if len(parts) == 2:
            has_verb_before = any(v in parts[0] for v in action_verbs)
            has_verb_after = any(v in parts[1] for v in action_verbs)
            if has_verb_before and has_verb_after:
                reasons.append("Description uses 'and' to join two distinct activities")

    # Check for multiple sentences with different activities
    sentences = re.split(r"[.!?]+", description.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) >= 3:
        reasons.append(f"Description contains {len(sentences)} sentences, suggesting multiple activities")

    # Check for long duration with vague description
    if duration_minutes and duration_minutes > 240:
        word_count = len(description.split())
        if word_count < 10:
            reasons.append(
                f"Entry is {duration_minutes / 60:.1f} hours but has only {word_count} words "
                f"- vague description for long entry"
            )

    is_block = len(reasons) > 0
    if len(reasons) >= 3:
        confidence = "high"
    elif len(reasons) == 2:
        confidence = "medium"
    else:
        confidence = "low"

    return BlockBillingResponse(is_block_billing=is_block, reasons=reasons, confidence=confidence)


# ── Guideline Compliance Check ───────────────────────────────────────────
async def check_compliance(db: AsyncSession, time_entry_id: uuid.UUID, client_id: uuid.UUID) -> ComplianceCheckResponse:
    """Check a time entry against all active billing guidelines for a client."""
    violations: list[ComplianceViolation] = []

    # Get the time entry
    entry_result = await db.execute(select(TimeEntry).where(TimeEntry.id == time_entry_id))
    entry = entry_result.scalar_one_or_none()
    if entry is None:
        violations.append(ComplianceViolation(rule="time_entry", message="Time entry not found", severity="error"))
        return ComplianceCheckResponse(compliant=False, violations=violations)

    # Get active guidelines for this client
    guidelines_result = await db.execute(
        select(BillingGuideline).where(BillingGuideline.client_id == client_id, BillingGuideline.is_active.is_(True))
    )
    guidelines = guidelines_result.scalars().all()

    if not guidelines:
        return ComplianceCheckResponse(compliant=True, violations=[])

    # Get codes assigned to this time entry
    codes_result = await db.execute(select(TimeEntryCode).where(TimeEntryCode.time_entry_id == time_entry_id))
    entry_codes = codes_result.scalars().all()

    # Load the actual UTBMS codes for the entry
    utbms_code_ids = [ec.utbms_code_id for ec in entry_codes]
    assigned_codes: list[UTBMSCode] = []
    if utbms_code_ids:
        codes_result = await db.execute(select(UTBMSCode).where(UTBMSCode.id.in_(utbms_code_ids)))
        assigned_codes = list(codes_result.scalars().all())

    assigned_code_strings = {c.code for c in assigned_codes}
    assigned_code_types = {c.code_type for c in assigned_codes}

    for guideline in guidelines:
        # Rate cap check
        if guideline.rate_cap_cents is not None and entry.rate_cents > guideline.rate_cap_cents:
            violations.append(
                ComplianceViolation(
                    rule="rate_cap",
                    message=(
                        f"Rate ${entry.rate_cents / 100:.2f}/hr exceeds cap "
                        f"${guideline.rate_cap_cents / 100:.2f}/hr ({guideline.name})"
                    ),
                    severity="error",
                )
            )

        # Daily hour cap check
        if guideline.daily_hour_cap is not None:
            day_total_result = await db.execute(
                select(func.coalesce(func.sum(TimeEntry.duration_minutes), 0)).where(
                    TimeEntry.user_id == entry.user_id,
                    TimeEntry.date == entry.date,
                    TimeEntry.billable.is_(True),
                )
            )
            day_total_minutes = day_total_result.scalar_one()
            day_total_hours = day_total_minutes / 60
            if day_total_hours > guideline.daily_hour_cap:
                violations.append(
                    ComplianceViolation(
                        rule="daily_hour_cap",
                        message=(
                            f"Total billable hours for this date ({day_total_hours:.1f}h) exceeds "
                            f"daily cap ({guideline.daily_hour_cap}h) ({guideline.name})"
                        ),
                        severity="error",
                    )
                )

        # Task code required
        if guideline.task_code_required:
            has_task = UTBMSCodeType.task in assigned_code_types or UTBMSCodeType.phase in assigned_code_types
            if not has_task:
                violations.append(
                    ComplianceViolation(
                        rule="task_code_required",
                        message=f"Task/phase code required but not assigned ({guideline.name})",
                        severity="error",
                    )
                )

        # Activity code required
        if guideline.activity_code_required:
            has_activity = UTBMSCodeType.activity in assigned_code_types
            if not has_activity:
                violations.append(
                    ComplianceViolation(
                        rule="activity_code_required",
                        message=f"Activity code required but not assigned ({guideline.name})",
                        severity="error",
                    )
                )

        # Restricted codes check
        if guideline.restricted_codes:
            used_restricted = assigned_code_strings & set(guideline.restricted_codes)
            if used_restricted:
                violations.append(
                    ComplianceViolation(
                        rule="restricted_codes",
                        message=(f"Restricted code(s) used: {', '.join(sorted(used_restricted))} ({guideline.name})"),
                        severity="error",
                    )
                )

        # Block billing check
        if guideline.block_billing_prohibited:
            bb_result = detect_block_billing(entry.description, entry.duration_minutes)
            if bb_result.is_block_billing:
                violations.append(
                    ComplianceViolation(
                        rule="block_billing",
                        message=f"Potential block billing detected ({guideline.name}): {bb_result.reasons[0]}",
                        severity="warning",
                    )
                )

    return ComplianceCheckResponse(compliant=len(violations) == 0, violations=violations)


# ── LEDES 1998B Export ───────────────────────────────────────────────────
async def export_ledes_1998b(db: AsyncSession, invoice_id: uuid.UUID) -> Optional[str]:
    """Generate LEDES 1998B formatted file content from an invoice."""
    # Load invoice with relationships
    invoice_result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = invoice_result.scalar_one_or_none()
    if invoice is None:
        return None

    # Load line items
    line_items_result = await db.execute(
        select(InvoiceLineItem).where(InvoiceLineItem.invoice_id == invoice_id).order_by(InvoiceLineItem.id)
    )
    line_items = line_items_result.scalars().all()

    # Load time entries for the line items (to get user info and codes)
    time_entry_ids = [li.time_entry_id for li in line_items if li.time_entry_id]
    time_entries_map: dict[uuid.UUID, TimeEntry] = {}
    if time_entry_ids:
        te_result = await db.execute(select(TimeEntry).where(TimeEntry.id.in_(time_entry_ids)))
        for te in te_result.scalars().all():
            time_entries_map[te.id] = te

    # Load UTBMS codes for all relevant time entries
    codes_map: dict[uuid.UUID, list[UTBMSCode]] = {}
    if time_entry_ids:
        tec_result = await db.execute(select(TimeEntryCode).where(TimeEntryCode.time_entry_id.in_(time_entry_ids)))
        tec_list = tec_result.scalars().all()
        utbms_ids = [tec.utbms_code_id for tec in tec_list]
        utbms_map: dict[uuid.UUID, UTBMSCode] = {}
        if utbms_ids:
            utbms_result = await db.execute(select(UTBMSCode).where(UTBMSCode.id.in_(utbms_ids)))
            for code in utbms_result.scalars().all():
                utbms_map[code.id] = code
        for tec in tec_list:
            if tec.time_entry_id not in codes_map:
                codes_map[tec.time_entry_id] = []
            if tec.utbms_code_id in utbms_map:
                codes_map[tec.time_entry_id].append(utbms_map[tec.utbms_code_id])

    # Determine billing period
    entry_dates = [te.date for te in time_entries_map.values()]
    billing_start = min(entry_dates) if entry_dates else (invoice.issued_date or date.today())
    billing_end = max(entry_dates) if entry_dates else (invoice.issued_date or date.today())

    # Build LEDES header
    header_cols = [
        "INVOICE_DATE",
        "INVOICE_NUMBER",
        "CLIENT_ID",
        "LAW_FIRM_MATTER_ID",
        "INVOICE_TOTAL",
        "BILLING_START_DATE",
        "BILLING_END_DATE",
        "INVOICE_DESCRIPTION",
        "LINE_ITEM_NUMBER",
        "EXP/FEE/INV_ADJ_TYPE",
        "LINE_ITEM_NUMBER_OF_UNITS",
        "LINE_ITEM_ADJUSTMENT_AMOUNT",
        "LINE_ITEM_TOTAL",
        "LINE_ITEM_DATE",
        "LINE_ITEM_TASK_CODE",
        "LINE_ITEM_EXPENSE_CODE",
        "LINE_ITEM_ACTIVITY_CODE",
        "TIMEKEEPER_ID",
        "LINE_ITEM_DESCRIPTION",
        "LAW_FIRM_ID",
        "LINE_ITEM_UNIT_COST",
        "TIMEKEEPER_NAME",
        "TIMEKEEPER_CLASSIFICATION",
    ]

    lines: list[str] = []
    lines.append("LEDES1998B[]")
    lines.append("|".join(header_cols) + "[]")

    # Format dates as YYYYMMDD per LEDES spec
    def fmt_date(d: date) -> str:
        return d.strftime("%Y%m%d")

    invoice_date = fmt_date(invoice.issued_date) if invoice.issued_date else fmt_date(date.today())
    invoice_number = str(invoice.invoice_number) if invoice.invoice_number else ""
    client_id = str(invoice.client_id)
    matter_id = str(invoice.matter_id)
    invoice_total = f"{invoice.total_cents / 100:.2f}"

    for idx, li in enumerate(line_items, start=1):
        te = time_entries_map.get(li.time_entry_id) if li.time_entry_id else None
        te_codes = codes_map.get(li.time_entry_id, []) if li.time_entry_id else []

        # Determine fee/expense type
        expense_codes = [c for c in te_codes if c.code_type == UTBMSCodeType.expense]
        is_expense = len(expense_codes) > 0
        fee_type = "E" if is_expense else "F"

        # Number of units (hours for fees, quantity for expenses)
        if te:
            units = f"{te.duration_minutes / 60:.2f}"
            unit_cost = f"{te.rate_cents / 100:.2f}"
            line_date = fmt_date(te.date)
        else:
            units = f"{li.quantity:.2f}"
            unit_cost = f"{li.rate_cents / 100:.2f}"
            line_date = invoice_date

        line_total = f"{li.amount_cents / 100:.2f}"

        # Extract UTBMS codes by type
        task_code = ""
        expense_code = ""
        activity_code = ""
        for c in te_codes:
            if c.code_type in (UTBMSCodeType.task, UTBMSCodeType.phase):
                task_code = c.code
            elif c.code_type == UTBMSCodeType.expense:
                expense_code = c.code
            elif c.code_type == UTBMSCodeType.activity:
                activity_code = c.code

        # Timekeeper info
        timekeeper_id = ""
        timekeeper_name = ""
        timekeeper_classification = ""
        if te and te.user:
            timekeeper_id = str(te.user_id)
            timekeeper_name = f"{te.user.first_name} {te.user.last_name}"
            timekeeper_classification = getattr(te.user, "role", "")
            if hasattr(timekeeper_classification, "value"):
                timekeeper_classification = timekeeper_classification.value

        row = [
            invoice_date,
            invoice_number,
            client_id,
            matter_id,
            invoice_total,
            fmt_date(billing_start),
            fmt_date(billing_end),
            "",  # INVOICE_DESCRIPTION
            str(idx),
            fee_type,
            units,
            "0.00",  # LINE_ITEM_ADJUSTMENT_AMOUNT
            line_total,
            line_date,
            task_code,
            expense_code,
            activity_code,
            timekeeper_id,
            li.description.replace("|", " ").replace("\n", " "),
            "",  # LAW_FIRM_ID
            unit_cost,
            timekeeper_name,
            timekeeper_classification,
        ]
        lines.append("|".join(row) + "[]")

    return "\n".join(lines)
