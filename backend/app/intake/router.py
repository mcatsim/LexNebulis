import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.intake.models import LeadSource, PipelineStage
from app.intake.schemas import (
    ConvertLeadRequest,
    IntakeFormCreate,
    IntakeFormResponse,
    IntakeFormUpdate,
    IntakeSubmissionCreate,
    IntakeSubmissionResponse,
    IntakeSubmissionReview,
    LeadCreate,
    LeadResponse,
    LeadUpdate,
    PipelineSummaryResponse,
)
from app.intake.service import (
    convert_lead,
    create_intake_form,
    create_lead,
    create_submission,
    delete_intake_form,
    delete_lead,
    get_intake_form,
    get_intake_forms,
    get_lead,
    get_leads,
    get_pipeline_summary,
    get_submissions,
    review_submission,
    update_intake_form,
    update_lead,
)

router = APIRouter()


# ── Lead Routes ───────────────────────────────────────────────────────


@router.get("/pipeline/summary", response_model=PipelineSummaryResponse)
async def pipeline_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return await get_pipeline_summary(db)


@router.get("", response_model=PaginatedResponse)
async def list_leads(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
    stage: Optional[PipelineStage] = None,
    source: Optional[LeadSource] = None,
    practice_area: Optional[str] = None,
    assigned_to: Optional[uuid.UUID] = None,
):
    leads, total = await get_leads(db, page, page_size, search, stage, source, practice_area, assigned_to)
    items = [LeadResponse.model_validate(lead).model_dump() for lead in leads]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_new_lead(
    data: LeadCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    lead = await create_lead(db, data)
    await create_audit_log(
        db,
        current_user.id,
        "lead",
        str(lead.id),
        "create",
        changes_json=json.dumps(data.model_dump(), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return lead


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead_detail(
    lead_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    lead = await get_lead(db, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_existing_lead(
    lead_id: uuid.UUID,
    data: LeadUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    lead = await get_lead(db, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    updated = await update_lead(db, lead, data)
    await create_audit_log(
        db,
        current_user.id,
        "lead",
        str(lead_id),
        "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return updated


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_lead(
    lead_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    lead = await get_lead(db, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    await delete_lead(db, lead)
    await create_audit_log(
        db,
        current_user.id,
        "lead",
        str(lead_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )


@router.post("/{lead_id}/convert", response_model=LeadResponse)
async def convert_lead_to_client(
    lead_id: uuid.UUID,
    data: ConvertLeadRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    lead = await get_lead(db, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if lead.converted_client_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lead has already been converted")

    converted = await convert_lead(db, lead, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "lead",
        str(lead_id),
        "convert",
        changes_json=json.dumps(
            {
                "converted_client_id": str(converted.converted_client_id),
                "converted_matter_id": str(converted.converted_matter_id) if converted.converted_matter_id else None,
            },
            default=str,
        ),
        ip_address=request.client.host if request.client else None,
    )
    return converted


# ── Intake Form Routes ───────────────────────────────────────────────


@router.get("/forms", response_model=PaginatedResponse)
async def list_intake_forms(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    is_active: Optional[bool] = None,
):
    forms, total = await get_intake_forms(db, page, page_size, is_active)
    items = [IntakeFormResponse.model_validate(f).model_dump() for f in forms]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("/forms", response_model=IntakeFormResponse, status_code=status.HTTP_201_CREATED)
async def create_new_intake_form(
    data: IntakeFormCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    form = await create_intake_form(db, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "intake_form",
        str(form.id),
        "create",
        changes_json=json.dumps({"name": data.name}, default=str),
        ip_address=request.client.host if request.client else None,
    )
    return form


@router.put("/forms/{form_id}", response_model=IntakeFormResponse)
async def update_existing_intake_form(
    form_id: uuid.UUID,
    data: IntakeFormUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    form = await get_intake_form(db, form_id)
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake form not found")

    updated = await update_intake_form(db, form, data)
    await create_audit_log(
        db,
        current_user.id,
        "intake_form",
        str(form_id),
        "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return updated


@router.delete("/forms/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_intake_form(
    form_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
):
    form = await get_intake_form(db, form_id)
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake form not found")

    await delete_intake_form(db, form)
    await create_audit_log(
        db,
        current_user.id,
        "intake_form",
        str(form_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )


@router.post("/forms/{form_id}/submit", response_model=IntakeSubmissionResponse, status_code=status.HTTP_201_CREATED)
async def submit_intake_form(
    form_id: uuid.UUID,
    data: IntakeSubmissionCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Public endpoint - no authentication required."""
    form = await get_intake_form(db, form_id)
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake form not found")
    if not form.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This intake form is no longer active")
    if not form.is_public:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This form is not publicly accessible")

    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    submission = await create_submission(db, form_id, data.data_json, ip_address, user_agent)
    return submission


# ── Submission Routes ────────────────────────────────────────────────


@router.get("/submissions", response_model=PaginatedResponse)
async def list_submissions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    form_id: Optional[uuid.UUID] = None,
    is_reviewed: Optional[bool] = None,
):
    submissions, total = await get_submissions(db, page, page_size, form_id, is_reviewed)
    items = [IntakeSubmissionResponse.model_validate(s).model_dump() for s in submissions]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.put("/submissions/{submission_id}/review", response_model=IntakeSubmissionResponse)
async def review_intake_submission(
    submission_id: uuid.UUID,
    data: IntakeSubmissionReview,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    # Find the submission
    from sqlalchemy import select

    from app.intake.models import IntakeSubmission

    result = await db.execute(select(IntakeSubmission).where(IntakeSubmission.id == submission_id))
    submission = result.scalar_one_or_none()
    if submission is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    reviewed = await review_submission(db, submission, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "intake_submission",
        str(submission_id),
        "review",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return reviewed
