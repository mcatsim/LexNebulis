import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    uploaded_by: uuid.UUID
    filename: str
    mime_type: str
    size_bytes: int
    version: int
    parent_document_id: Optional[uuid.UUID]
    tags_json: Optional[list]
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentUploadResponse(BaseModel):
    id: uuid.UUID
    filename: str
    size_bytes: int
    version: int


class DocumentTagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#228BE6", max_length=7)


class DocumentTagResponse(BaseModel):
    id: uuid.UUID
    name: str
    color: str

    model_config = {"from_attributes": True}
