import json
import uuid
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user
from app.emails.schemas import (
    EmailAttachmentCreate,
    EmailAttachmentResponse,
    EmailSummaryResponse,
    EmailThreadResponse,
    FiledEmailResponse,
    FileEmailCreate,
    FileEmailUpdate,
    MatterSuggestionResponse,
)
from app.emails.service import (
    add_attachment,
    delete_filed_email,
    file_email,
    get_email_thread,
    get_filed_email,
    get_matter_email_summary,
    list_filed_emails,
    suggest_matters,
    update_filed_email,
)

router = APIRouter()


def _email_to_response(email) -> dict:
    """Convert a FiledEmail model to response dict with filed_by_name."""
    resp = FiledEmailResponse.model_validate(email)
    if email.filed_by_user:
        resp.filed_by_name = email.filed_by_user.full_name
    return resp.model_dump()


@router.post("", response_model=FiledEmailResponse, status_code=status.HTTP_201_CREATED)
async def file_email_to_matter(
    request: Request,
    data: FileEmailCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """File an email to a matter."""
    email = await file_email(db, data, current_user.id)
    await create_audit_log(
        db,
        current_user.id,
        "email",
        str(email.id),
        "create",
        changes_json=json.dumps({"subject": data.subject, "matter_id": str(data.matter_id)}),
        ip_address=request.client.host if request.client else None,
    )
    return _email_to_response(email)


@router.get("", response_model=PaginatedResponse)
async def list_emails(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    matter_id: Optional[uuid.UUID] = None,
    direction: Optional[str] = None,
    search: Optional[str] = None,
    from_address: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    has_attachments: Optional[bool] = None,
    page: int = 1,
    page_size: int = 25,
):
    """List filed emails with filters."""
    emails, total = await list_filed_emails(
        db,
        matter_id=matter_id,
        direction=direction,
        search=search,
        from_address=from_address,
        start_date=start_date,
        end_date=end_date,
        has_attachments=has_attachments,
        page=page,
        page_size=page_size,
    )
    items = [_email_to_response(e) for e in emails]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/suggest-matter", response_model=list[MatterSuggestionResponse])
async def suggest_matter_for_email(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    addresses: str = Query(..., description="Comma-separated email addresses"),
):
    """Suggest matters for given email addresses."""
    address_list = [a.strip() for a in addresses.split(",") if a.strip()]
    suggestions = await suggest_matters(db, address_list)
    return suggestions


@router.get("/summary", response_model=list[EmailSummaryResponse])
async def email_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    matter_id: Optional[uuid.UUID] = None,
):
    """Get email summary per matter."""
    return await get_matter_email_summary(db, matter_id)


@router.get("/{email_id}", response_model=FiledEmailResponse)
async def get_email_detail(
    email_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get a filed email by ID."""
    email = await get_filed_email(db, email_id)
    if email is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")
    return _email_to_response(email)


@router.put("/{email_id}", response_model=FiledEmailResponse)
async def update_email(
    email_id: uuid.UUID,
    request: Request,
    data: FileEmailUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Update a filed email (notes, tags, or re-file to different matter)."""
    email = await get_filed_email(db, email_id)
    if email is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    updated = await update_filed_email(db, email, data)
    await create_audit_log(
        db,
        current_user.id,
        "email",
        str(email_id),
        "update",
        changes_json=json.dumps(data.model_dump(exclude_none=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return _email_to_response(updated)


@router.delete("/{email_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_email(
    email_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Delete a filed email."""
    email = await get_filed_email(db, email_id)
    if email is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    await delete_filed_email(db, email)
    await create_audit_log(
        db,
        current_user.id,
        "email",
        str(email_id),
        "delete",
        changes_json=json.dumps({"subject": email.subject}),
        ip_address=request.client.host if request.client else None,
    )


@router.get("/{email_id}/thread", response_model=EmailThreadResponse)
async def get_thread(
    email_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get all emails in the same thread as the given email."""
    email = await get_filed_email(db, email_id)
    if email is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    if not email.thread_id:
        # Single email, no thread
        return EmailThreadResponse(thread_id=str(email.id), emails=[_email_to_response(email)])

    thread_emails = await get_email_thread(db, email.thread_id)
    return EmailThreadResponse(
        thread_id=email.thread_id,
        emails=[_email_to_response(e) for e in thread_emails],
    )


@router.post("/{email_id}/attachments", response_model=EmailAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def add_email_attachment(
    email_id: uuid.UUID,
    request: Request,
    data: EmailAttachmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Add attachment metadata to a filed email."""
    email = await get_filed_email(db, email_id)
    if email is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    attachment = await add_attachment(db, email_id, data)
    await create_audit_log(
        db,
        current_user.id,
        "email_attachment",
        str(attachment.id),
        "create",
        changes_json=json.dumps({"filename": data.filename, "email_id": str(email_id)}),
        ip_address=request.client.host if request.client else None,
    )
    return attachment
