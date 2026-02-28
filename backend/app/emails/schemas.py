import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

# ── Create / Update ────────────────────────────────────────────────


class FileEmailCreate(BaseModel):
    matter_id: uuid.UUID
    direction: str = Field(default="inbound", pattern="^(inbound|outbound)$")
    subject: Optional[str] = Field(None, max_length=1000)
    from_address: Optional[str] = Field(None, max_length=500)
    to_addresses: Optional[list[str]] = None
    cc_addresses: Optional[list[str]] = None
    bcc_addresses: Optional[list[str]] = None
    date_sent: Optional[datetime] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    message_id: Optional[str] = Field(None, max_length=500)
    in_reply_to: Optional[str] = Field(None, max_length=500)
    thread_id: Optional[str] = Field(None, max_length=500)
    tags: Optional[list[str]] = None
    notes: Optional[str] = None
    source: Optional[str] = Field(None, max_length=100)


class FileEmailUpdate(BaseModel):
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    matter_id: Optional[uuid.UUID] = None


# ── Responses ──────────────────────────────────────────────────────


class EmailAttachmentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=500)
    mime_type: Optional[str] = Field(None, max_length=255)
    size_bytes: Optional[int] = None


class EmailAttachmentResponse(BaseModel):
    id: uuid.UUID
    email_id: uuid.UUID
    filename: str
    mime_type: Optional[str]
    size_bytes: Optional[int]
    storage_key: Optional[str]
    document_id: Optional[uuid.UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


class FiledEmailResponse(BaseModel):
    id: uuid.UUID
    matter_id: uuid.UUID
    filed_by: uuid.UUID
    filed_by_name: Optional[str] = None
    direction: str
    subject: Optional[str]
    from_address: Optional[str]
    to_addresses: Optional[list[str]]
    cc_addresses: Optional[list[str]]
    bcc_addresses: Optional[list[str]]
    date_sent: Optional[datetime]
    body_text: Optional[str]
    body_html: Optional[str]
    message_id: Optional[str]
    in_reply_to: Optional[str]
    thread_id: Optional[str]
    has_attachments: bool
    attachment_count: int
    headers_json: Optional[dict[str, str]]
    tags: Optional[list[str]]
    notes: Optional[str]
    source: Optional[str]
    attachments: list[EmailAttachmentResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MatterSuggestionResponse(BaseModel):
    matter_id: uuid.UUID
    matter_title: str
    confidence: float
    use_count: int

    model_config = {"from_attributes": True}


class EmailSearchParams(BaseModel):
    matter_id: Optional[uuid.UUID] = None
    search: Optional[str] = None
    from_address: Optional[str] = None
    direction: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    has_attachments: Optional[bool] = None


class EmailThreadResponse(BaseModel):
    thread_id: str
    emails: list[FiledEmailResponse]


class EmailSummaryResponse(BaseModel):
    matter_id: uuid.UUID
    matter_title: str
    email_count: int
    latest_email_date: Optional[datetime]

    model_config = {"from_attributes": True}
