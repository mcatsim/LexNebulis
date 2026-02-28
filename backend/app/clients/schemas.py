import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.clients.models import ClientStatus, ClientType


class ClientCreate(BaseModel):
    client_type: ClientType = ClientType.individual
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    organization_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address_json: dict | None = None
    notes: str | None = None
    status: ClientStatus = ClientStatus.active


class ClientUpdate(BaseModel):
    client_type: ClientType | None = None
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    organization_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address_json: dict | None = None
    notes: str | None = None
    status: ClientStatus | None = None


class ClientResponse(BaseModel):
    id: uuid.UUID
    client_number: int
    client_type: ClientType
    first_name: str | None
    last_name: str | None
    organization_name: str | None
    email: str | None
    phone: str | None
    address_json: dict | None
    notes: str | None
    status: ClientStatus
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
