import enum
from typing import Optional

from sqlalchemy import Enum, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.common.base_models import TimestampMixin, UUIDBase


class ContactRole(str, enum.Enum):
    judge = "judge"
    witness = "witness"
    opposing_counsel = "opposing_counsel"
    expert = "expert"
    other = "other"


class Contact(UUIDBase, TimestampMixin):
    __tablename__ = "contacts"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[ContactRole] = mapped_column(Enum(ContactRole), nullable=False, default=ContactRole.other)
    organization: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
