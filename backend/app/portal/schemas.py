import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

# ── Client User schemas ──────────────────────────────────────────────


class ClientUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    client_id: uuid.UUID


class ClientUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)


class ClientUserResponse(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Client Auth schemas ──────────────────────────────────────────────


class ClientLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class ClientLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ── Portal Matter schemas ────────────────────────────────────────────


class PortalMatterResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    litigation_type: str
    date_opened: date
    date_closed: Optional[date] = None
    description: Optional[str] = None
    attorney_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Portal Invoice schemas ───────────────────────────────────────────


class PortalInvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: Optional[int] = None
    matter_title: Optional[str] = None
    total_cents: int
    status: str
    issued_date: Optional[date] = None
    due_date: Optional[date] = None

    model_config = {"from_attributes": True}


# ── Shared Document schemas ──────────────────────────────────────────


class ShareDocumentRequest(BaseModel):
    document_id: uuid.UUID
    matter_id: uuid.UUID
    note: Optional[str] = None


class SharedDocumentResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    matter_id: uuid.UUID
    filename: str
    mime_type: str
    size_bytes: int
    shared_by_name: str
    shared_at: datetime
    note: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Message schemas ──────────────────────────────────────────────────


class MessageCreate(BaseModel):
    matter_id: uuid.UUID
    body: str = Field(min_length=1)
    subject: Optional[str] = Field(default=None, max_length=500)
    parent_message_id: Optional[uuid.UUID] = None


class MessageResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    sender_type: str
    sender_name: str
    subject: Optional[str] = None
    body: str
    parent_message_id: Optional[uuid.UUID] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    unread_count: int
