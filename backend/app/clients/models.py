import enum
import uuid
from datetime import datetime

from sqlalchemy import Enum, Integer, Sequence, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.base_models import TimestampMixin, UUIDBase

client_number_seq = Sequence("client_number_seq", start=1001)


class ClientType(str, enum.Enum):
    individual = "individual"
    organization = "organization"


class ClientStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    archived = "archived"


class Client(UUIDBase, TimestampMixin):
    __tablename__ = "clients"

    client_number: Mapped[int] = mapped_column(Integer, client_number_seq, server_default=client_number_seq.next_value(), unique=True)
    client_type: Mapped[ClientType] = mapped_column(Enum(ClientType), nullable=False, default=ClientType.individual)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    organization_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ClientStatus] = mapped_column(Enum(ClientStatus), nullable=False, default=ClientStatus.active)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Relationships
    matters = relationship("Matter", back_populates="client", lazy="selectin")

    @property
    def display_name(self) -> str:
        if self.client_type == ClientType.organization:
            return self.organization_name or ""
        return f"{self.first_name or ''} {self.last_name or ''}".strip()
