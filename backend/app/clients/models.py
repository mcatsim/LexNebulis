import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Enum, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import GUID, TimestampMixin, UUIDBase


class ClientType(str, enum.Enum):
    individual = "individual"
    organization = "organization"


class ClientStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    archived = "archived"


class Client(UUIDBase, TimestampMixin):
    __tablename__ = "clients"

    client_number: Mapped[int] = mapped_column(Integer, unique=True, nullable=True)
    client_type: Mapped[ClientType] = mapped_column(Enum(ClientType), nullable=False, default=ClientType.individual)
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    organization_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ClientStatus] = mapped_column(Enum(ClientStatus), nullable=False, default=ClientStatus.active)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(GUID(), nullable=True)

    # Relationships
    matters = relationship("Matter", back_populates="client", lazy="selectin")

    @property
    def display_name(self) -> str:
        if self.client_type == ClientType.organization:
            return self.organization_name or ""
        return f"{self.first_name or ''} {self.last_name or ''}".strip()
