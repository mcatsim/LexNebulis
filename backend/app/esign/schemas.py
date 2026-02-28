import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

# ── Create schemas ──────────────────────────────────────────────────────────────


class SignerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=1, max_length=255)
    role: Optional[str] = Field(default=None, max_length=100)
    order: int = Field(default=1, ge=1)


class SignatureRequestCreate(BaseModel):
    document_id: uuid.UUID
    matter_id: uuid.UUID
    title: str = Field(min_length=1, max_length=500)
    message: Optional[str] = None
    expires_at: Optional[datetime] = None
    signers: list[SignerCreate] = Field(min_length=1)


# ── Response schemas ────────────────────────────────────────────────────────────


class SignerResponse(BaseModel):
    id: uuid.UUID
    signature_request_id: uuid.UUID
    name: str
    email: str
    role: Optional[str]
    order: int
    status: str
    access_token: str
    signed_at: Optional[datetime]
    signed_ip: Optional[str]
    signed_user_agent: Optional[str]
    decline_reason: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SignatureAuditEntryResponse(BaseModel):
    id: uuid.UUID
    signature_request_id: uuid.UUID
    signer_id: Optional[uuid.UUID]
    action: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    details: Optional[str]
    timestamp: datetime

    model_config = {"from_attributes": True}


class SignatureRequestResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    matter_id: uuid.UUID
    created_by: uuid.UUID
    title: str
    message: Optional[str]
    status: str
    expires_at: Optional[datetime]
    completed_at: Optional[datetime]
    certificate_storage_key: Optional[str]
    signers: list[SignerResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Public signing page schemas ─────────────────────────────────────────────────


class SigningPageInfo(BaseModel):
    request_title: str
    message: Optional[str]
    signer_name: str
    signer_email: str
    signer_status: str
    document_download_url: str


class SignRequest(BaseModel):
    acceptance: bool = True


class DeclineRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


# ── Certificate of completion ───────────────────────────────────────────────────


class CertificateSignerInfo(BaseModel):
    name: str
    email: str
    signed_at: Optional[str]
    ip_address: Optional[str]


class CertificateOfCompletion(BaseModel):
    request_title: str
    document_name: str
    signers: list[CertificateSignerInfo]
    created_at: str
    completed_at: str
    document_hash: Optional[str] = None
