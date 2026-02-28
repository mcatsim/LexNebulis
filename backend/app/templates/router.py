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
from app.documents.service import get_download_url
from app.templates.models import TemplateCategory
from app.templates.schemas import (
    DocumentTemplateResponse,
    DocumentTemplateUpdate,
    GeneratedDocumentResponse,
    GenerateDocumentRequest,
    GenerateDocumentResponse,
    TemplateVariablesResponse,
)
from app.templates.service import (
    build_template_context,
    delete_template,
    generate_document,
    get_generated_documents,
    get_template,
    get_template_variables,
    get_templates,
    update_template,
    upload_template,
)

router = APIRouter()


@router.post("/upload", response_model=DocumentTemplateResponse, status_code=status.HTTP_201_CREATED)
async def upload_new_template(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    practice_area: Optional[str] = Form(None),
    category: TemplateCategory = Form(TemplateCategory.other),
):
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 50MB)",
        )

    filename = file.filename or "unnamed.docx"
    if not filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .docx files are supported as templates",
        )

    try:
        template = await upload_template(
            db, content, filename, name, description, practice_area, category, current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await create_audit_log(
        db,
        current_user.id,
        "template",
        str(template.id),
        "create",
        changes_json=json.dumps({"name": name, "filename": filename, "category": category.value}),
        ip_address=request.client.host if request.client else None,
    )
    return template


@router.get("", response_model=PaginatedResponse)
async def list_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    practice_area: Optional[str] = None,
    category: Optional[TemplateCategory] = None,
    search: Optional[str] = None,
):
    templates, total = await get_templates(db, page, page_size, practice_area, category, search)
    items = [DocumentTemplateResponse.model_validate(t).model_dump() for t in templates]
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/generated", response_model=PaginatedResponse)
async def list_generated_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 25,
    template_id: Optional[uuid.UUID] = None,
    matter_id: Optional[uuid.UUID] = None,
):
    gen_docs, total = await get_generated_documents(db, page, page_size, template_id, matter_id)
    items = []
    for gd in gen_docs:
        response = GeneratedDocumentResponse.model_validate(gd)
        response.template_name = gd.template.name if gd.template else None
        items.append(response.model_dump())
    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{template_id}", response_model=DocumentTemplateResponse)
async def get_template_detail(
    template_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    template = await get_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=DocumentTemplateResponse)
async def update_existing_template(
    template_id: uuid.UUID,
    data: DocumentTemplateUpdate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    template = await get_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    updated = await update_template(db, template, data)
    await create_audit_log(
        db,
        current_user.id,
        "template",
        str(template_id),
        "update",
        changes_json=json.dumps(data.model_dump(exclude_unset=True), default=str),
        ip_address=request.client.host if request.client else None,
    )
    return updated


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_template(
    template_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney"))],
):
    template = await get_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    await delete_template(db, template)
    await create_audit_log(
        db,
        current_user.id,
        "template",
        str(template_id),
        "delete",
        ip_address=request.client.host if request.client else None,
    )


@router.get("/{template_id}/variables", response_model=TemplateVariablesResponse)
async def get_variables(
    template_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    template = await get_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    try:
        variables = get_template_variables(template.storage_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse template: {str(e)}",
        )

    return TemplateVariablesResponse(variables=variables, context={})


@router.post("/{template_id}/preview-context/{matter_id}")
async def preview_context(
    template_id: uuid.UUID,
    matter_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    template = await get_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    try:
        context = await build_template_context(db, matter_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    # Get template variables to pair with context
    try:
        variables = get_template_variables(template.storage_key)
    except Exception:
        variables = []

    return TemplateVariablesResponse(variables=variables, context=context)


@router.post("/generate", response_model=GenerateDocumentResponse)
async def generate_document_from_template(
    data: GenerateDocumentRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "attorney", "paralegal"))],
):
    try:
        gen_doc, doc_record = await generate_document(
            db, data.template_id, data.matter_id, current_user.id, data.custom_overrides
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    template = await get_template(db, data.template_id)
    template_name = template.name if template else "Unknown"

    await create_audit_log(
        db,
        current_user.id,
        "template",
        str(data.template_id),
        "generate",
        changes_json=json.dumps(
            {
                "template_id": str(data.template_id),
                "matter_id": str(data.matter_id),
                "document_id": str(doc_record.id),
            }
        ),
        ip_address=request.client.host if request.client else None,
    )

    return GenerateDocumentResponse(
        document_id=doc_record.id,
        filename=doc_record.filename,
        matter_id=data.matter_id,
        template_name=template_name,
    )


@router.get("/{template_id}/download")
async def download_template(
    template_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    template = await get_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    url = get_download_url(template.storage_key)
    return RedirectResponse(url=url)
