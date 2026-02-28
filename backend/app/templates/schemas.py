import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.templates.models import TemplateCategory


class DocumentTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    practice_area: Optional[str]
    category: TemplateCategory
    filename: str
    version: int
    is_active: bool
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    practice_area: Optional[str] = Field(default=None, max_length=100)
    category: Optional[TemplateCategory] = None
    is_active: Optional[bool] = None


class TemplateVariablesResponse(BaseModel):
    variables: list[str]
    context: dict


class GenerateDocumentRequest(BaseModel):
    template_id: uuid.UUID
    matter_id: uuid.UUID
    custom_overrides: Optional[dict[str, str]] = None


class GenerateDocumentResponse(BaseModel):
    document_id: uuid.UUID
    filename: str
    matter_id: uuid.UUID
    template_name: str


class GeneratedDocumentResponse(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    template_name: Optional[str] = None
    matter_id: uuid.UUID
    document_id: Optional[uuid.UUID]
    generated_by: uuid.UUID
    context_json: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
