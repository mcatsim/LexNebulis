import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.models import Client, ClientStatus, ClientType
from app.intake.models import IntakeForm, IntakeSubmission, Lead, LeadSource, PipelineStage
from app.intake.schemas import (
    ConvertLeadRequest,
    IntakeFormCreate,
    IntakeFormUpdate,
    IntakeSubmissionReview,
    LeadCreate,
    LeadUpdate,
    PipelineStageSummary,
    PipelineSummaryResponse,
)
from app.matters.models import Matter, MatterStatus

# ── Lead CRUD ─────────────────────────────────────────────────────────


async def get_leads(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    stage: Optional[PipelineStage] = None,
    source: Optional[LeadSource] = None,
    practice_area: Optional[str] = None,
    assigned_to: Optional[uuid.UUID] = None,
) -> tuple[list[Lead], int]:
    query = select(Lead)
    count_query = select(func.count(Lead.id))

    if search:
        search_filter = or_(
            Lead.first_name.ilike(f"%{search}%"),
            Lead.last_name.ilike(f"%{search}%"),
            Lead.email.ilike(f"%{search}%"),
            Lead.organization.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if stage:
        query = query.where(Lead.stage == stage)
        count_query = count_query.where(Lead.stage == stage)

    if source:
        query = query.where(Lead.source == source)
        count_query = count_query.where(Lead.source == source)

    if practice_area:
        query = query.where(Lead.practice_area == practice_area)
        count_query = count_query.where(Lead.practice_area == practice_area)

    if assigned_to:
        query = query.where(Lead.assigned_to == assigned_to)
        count_query = count_query.where(Lead.assigned_to == assigned_to)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(Lead.created_at.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_lead(db: AsyncSession, lead_id: uuid.UUID) -> Optional[Lead]:
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    return result.scalar_one_or_none()


async def create_lead(db: AsyncSession, data: LeadCreate) -> Lead:
    lead = Lead(**data.model_dump())
    db.add(lead)
    await db.flush()
    await db.refresh(lead)
    return lead


async def update_lead(db: AsyncSession, lead: Lead, data: LeadUpdate) -> Lead:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    await db.flush()
    await db.refresh(lead)
    return lead


async def delete_lead(db: AsyncSession, lead: Lead) -> None:
    await db.delete(lead)
    await db.flush()


# ── Lead Conversion ──────────────────────────────────────────────────


async def convert_lead(
    db: AsyncSession,
    lead: Lead,
    data: ConvertLeadRequest,
    created_by: uuid.UUID,
) -> Lead:
    """Convert a lead into a Client and optionally a Matter."""
    # Determine client type
    client_type = ClientType.organization if data.client_type == "organization" else ClientType.individual

    # Create Client
    client = Client(
        client_type=client_type,
        first_name=lead.first_name,
        last_name=lead.last_name,
        organization_name=data.organization_name or lead.organization,
        email=lead.email,
        phone=lead.phone,
        notes=lead.notes,
        status=ClientStatus.active,
        created_by=created_by,
    )
    db.add(client)
    await db.flush()

    # Auto-assign client_number
    max_num = await db.execute(select(func.coalesce(func.max(Client.client_number), 1000)))
    client.client_number = max_num.scalar() + 1
    await db.flush()

    # Optionally create Matter
    matter = None
    if data.create_matter and data.matter_title:
        matter = Matter(
            title=data.matter_title,
            client_id=client.id,
            status=MatterStatus.open,
            jurisdiction=data.jurisdiction,
        )
        # Set litigation_type if provided
        if data.litigation_type:
            from app.matters.models import LitigationType

            try:
                matter.litigation_type = LitigationType(data.litigation_type)
            except ValueError:
                matter.litigation_type = LitigationType.other
        db.add(matter)
        await db.flush()

        # Auto-assign matter_number
        max_matter_num = await db.execute(select(func.coalesce(func.max(Matter.matter_number), 10000)))
        matter.matter_number = max_matter_num.scalar() + 1
        await db.flush()

    # Update the lead
    lead.converted_client_id = client.id
    if matter:
        lead.converted_matter_id = matter.id
    lead.converted_at = datetime.now(timezone.utc)
    lead.stage = PipelineStage.retained
    await db.flush()
    await db.refresh(lead)
    return lead


# ── Pipeline Summary ─────────────────────────────────────────────────


async def get_pipeline_summary(db: AsyncSession) -> PipelineSummaryResponse:
    result = await db.execute(
        select(
            Lead.stage,
            func.count(Lead.id).label("count"),
            func.coalesce(func.sum(Lead.estimated_value_cents), 0).label("total_value"),
        ).group_by(Lead.stage)
    )
    rows = result.all()

    stages = []
    total_leads = 0
    total_value = 0
    for row in rows:
        stages.append(PipelineStageSummary(stage=row.stage, count=row.count, total_value_cents=row.total_value))
        total_leads += row.count
        total_value += row.total_value

    return PipelineSummaryResponse(stages=stages, total_leads=total_leads, total_value_cents=total_value)


# ── Intake Form CRUD ─────────────────────────────────────────────────


async def get_intake_forms(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    is_active: Optional[bool] = None,
) -> tuple[list[IntakeForm], int]:
    query = select(IntakeForm)
    count_query = select(func.count(IntakeForm.id))

    if is_active is not None:
        query = query.where(IntakeForm.is_active == is_active)
        count_query = count_query.where(IntakeForm.is_active == is_active)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(IntakeForm.created_at.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def get_intake_form(db: AsyncSession, form_id: uuid.UUID) -> Optional[IntakeForm]:
    result = await db.execute(select(IntakeForm).where(IntakeForm.id == form_id))
    return result.scalar_one_or_none()


async def create_intake_form(db: AsyncSession, data: IntakeFormCreate, created_by: uuid.UUID) -> IntakeForm:
    form = IntakeForm(**data.model_dump(), created_by=created_by)
    db.add(form)
    await db.flush()
    await db.refresh(form)
    return form


async def update_intake_form(db: AsyncSession, form: IntakeForm, data: IntakeFormUpdate) -> IntakeForm:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(form, field, value)
    await db.flush()
    await db.refresh(form)
    return form


async def delete_intake_form(db: AsyncSession, form: IntakeForm) -> None:
    await db.delete(form)
    await db.flush()


# ── Intake Submission ────────────────────────────────────────────────


async def get_submissions(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    form_id: Optional[uuid.UUID] = None,
    is_reviewed: Optional[bool] = None,
) -> tuple[list[IntakeSubmission], int]:
    query = select(IntakeSubmission)
    count_query = select(func.count(IntakeSubmission.id))

    if form_id:
        query = query.where(IntakeSubmission.form_id == form_id)
        count_query = count_query.where(IntakeSubmission.form_id == form_id)

    if is_reviewed is not None:
        query = query.where(IntakeSubmission.is_reviewed == is_reviewed)
        count_query = count_query.where(IntakeSubmission.is_reviewed == is_reviewed)

    total = (await db.execute(count_query)).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(IntakeSubmission.created_at.desc()).offset(offset).limit(page_size))
    return result.scalars().all(), total


async def create_submission(
    db: AsyncSession,
    form_id: uuid.UUID,
    data_json: dict,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> IntakeSubmission:
    submission = IntakeSubmission(
        form_id=form_id,
        data_json=data_json,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(submission)
    await db.flush()
    await db.refresh(submission)
    return submission


async def review_submission(
    db: AsyncSession,
    submission: IntakeSubmission,
    data: IntakeSubmissionReview,
    reviewed_by: uuid.UUID,
) -> IntakeSubmission:
    lead_id = data.lead_id

    # Optionally create a new lead from submission data
    if data.create_lead and data.lead_first_name and data.lead_last_name:
        lead_data = LeadCreate(
            first_name=data.lead_first_name,
            last_name=data.lead_last_name,
            email=data.lead_email,
            phone=data.lead_phone,
        )
        lead = await create_lead(db, lead_data)
        lead_id = lead.id

    submission.lead_id = lead_id
    submission.is_reviewed = True
    submission.reviewed_by = reviewed_by
    submission.reviewed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(submission)
    return submission
