import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.contacts.models import ContactRole


class ContactCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: ContactRole = ContactRole.other
    organization: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address_json: dict | None = None
    notes: str | None = None


class ContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    role: ContactRole | None = None
    organization: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    address_json: dict | None = None
    notes: str | None = None


class ContactResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    role: ContactRole
    organization: str | None
    email: str | None
    phone: str | None
    address_json: dict | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
