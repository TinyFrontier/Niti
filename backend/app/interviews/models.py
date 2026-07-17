import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import InterviewFormat, InterviewResult
from app.common.model_mixins import (
    OwnedMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPkMixin,
    str_enum,
)
from app.core.database import Base

if TYPE_CHECKING:
    from app.applications.models import Application


class Interview(UUIDPkMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "interviews"

    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    format: Mapped[InterviewFormat] = mapped_column(
        str_enum(InterviewFormat), default=InterviewFormat.VIDEO, nullable=False
    )
    location_or_link: Mapped[str | None] = mapped_column(String(500))
    # free-form list of participants; can be linked to contacts later
    participants: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    result: Mapped[InterviewResult | None] = mapped_column(str_enum(InterviewResult))

    application: Mapped["Application"] = relationship(back_populates="interviews")
