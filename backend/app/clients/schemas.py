import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.clients.models import ClientStatus, ClientType


class ClientCreate(BaseModel):
    client_type: ClientType = ClientType.individual
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    organization_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    address_json: Optional[dict] = None
    notes: Optional[str] = None
    status: ClientStatus = ClientStatus.active


class ClientUpdate(BaseModel):
    client_type: Optional[ClientType] = None
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    organization_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    address_json: Optional[dict] = None
    notes: Optional[str] = None
    status: Optional[ClientStatus] = None


class ClientResponse(BaseModel):
    id: uuid.UUID
    client_number: int
    client_type: ClientType
    first_name: Optional[str]
    last_name: Optional[str]
    organization_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address_json: Optional[dict]
    notes: Optional[str]
    status: ClientStatus
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
