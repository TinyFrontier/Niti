import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import (
    CommunicationChannel,
    CommunicationDirection,
    ContactStatus,
    ContactType,
)
from app.common.model_mixins import (
    OwnedMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPkMixin,
    str_enum,
)
from app.core.database import Base

if TYPE_CHECKING:
    from app.companies.models import Company


class Contact(UUIDPkMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "contacts"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(100))
    contact_type: Mapped[ContactType] = mapped_column(
        str_enum(ContactType), default=ContactType.OTHER, index=True, nullable=False
    )
    status: Mapped[ContactStatus] = mapped_column(
        str_enum(ContactStatus), default=ContactStatus.NEW, index=True, nullable=False
    )
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    telegram: Mapped[str | None] = mapped_column(String(100))
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    position: Mapped[str | None] = mapped_column(String(255))
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), index=True
    )

    company: Mapped["Company | None"] = relationship(back_populates="contacts")
    communication_logs: Mapped[list["CommunicationLog"]] = relationship(
        back_populates="contact", cascade="all, delete-orphan"
    )


class CommunicationLog(UUIDPkMixin, OwnedMixin, TimestampMixin, Base):
    __tablename__ = "communication_logs"

    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("applications.id", ondelete="SET NULL"), index=True
    )
    channel: Mapped[CommunicationChannel] = mapped_column(
        str_enum(CommunicationChannel), nullable=False
    )
    direction: Mapped[CommunicationDirection] = mapped_column(
        str_enum(CommunicationDirection), nullable=False
    )
    subject: Mapped[str | None] = mapped_column(String(500))
    body: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    next_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    contact: Mapped["Contact"] = relationship(back_populates="communication_logs")
