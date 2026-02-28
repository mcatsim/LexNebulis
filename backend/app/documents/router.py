import json
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import create_audit_log
from app.common.pagination import PaginatedResponse
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.documents.schemas import DocumentResponse, DocumentUploadResponse
from app.documents.service import delete_document, get_document, get_documents, get_download_url, upload_document

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    matter_id: Optional[uuid.UUID] = None,
    page: int = 1,
    page_size: int = 25,
    search: Optional[str] = None,
):
    docs, total = await get_documents(db, matter_id, page, page_size, search)
    items = [DocumentResponse.model_validate(d).model_dump() for d in docs]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_new_document(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
    file: UploadFile = File(...),
    matter_id: uuid.UUID = Form(...),
    description: Optional[str] = Form(None),
    parent_document_id: Optional[uuid.UUID] = Form(None),
):
    content = await file.read()
    if len(content) > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 100MB)")

    doc = await upload_document(
        db, matter_id, current_user.id, file.filename or "unnamed",
        content, file.content_type or "application/octet-stream",
        description=description, parent_document_id=parent_document_id,
    )
    await create_audit_log(
        db, current_user.id, "document", str(doc.id), "create",
        changes_json=json.dumps({"filename": doc.filename, "matter_id": str(matter_id)}),
        ip_address=request.client.host if request.client else None,
    )
    return DocumentUploadResponse(id=doc.id, filename=doc.filename, size_bytes=doc.size_bytes, version=doc.version)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document_detail(
    document_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    doc = await get_document(db, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.get("/{document_id}/download")
async def download_document(
    document_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    doc = await get_document(db, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    url = get_download_url(doc.storage_key)
    return RedirectResponse(url=url)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_document(
    document_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    doc = await get_document(db, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await delete_document(db, doc)
    await create_audit_log(
        db, current_user.id, "document", str(document_id), "delete",
        changes_json=json.dumps({"filename": doc.filename}),
        ip_address=request.client.host if request.client else None,
    )
