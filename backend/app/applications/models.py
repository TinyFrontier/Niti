import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import ApplicationStatus
from app.common.model_mixins import (
    OwnedMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPkMixin,
    str_enum,
)
from app.core.database import Base

if TYPE_CHECKING:
    from app.cv_versions.models import CVVersion
    from app.interviews.models import Interview
    from app.vacancies.models import Vacancy


class Application(UUIDPkMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "applications"

    vacancy_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vacancies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cv_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("cv_versions.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[ApplicationStatus] = mapped_column(
        str_enum(ApplicationStatus), default=ApplicationStatus.SAVED, index=True, nullable=False
    )
    applied_at: Mapped[date | None] = mapped_column(Date)
    # platform through which the application was sent (hh, linkedin, email, referral...)
    source: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)

    vacancy: Mapped["Vacancy"] = relationship(back_populates="applications")
    cv_version: Mapped["CVVersion | None"] = relationship(back_populates="applications")
    interviews: Mapped[list["Interview"]] = relationship(back_populates="application")


class ApplicationStatusHistory(UUIDPkMixin, OwnedMixin, Base):
    """Append-only log of application status transitions (from_status is NULL on creation)."""

    __tablename__ = "application_status_history"
    __table_args__ = (
        Index(
            "ix_application_status_history_application_id_changed_at",
            "application_id",
            "changed_at",
        ),
    )

    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    from_status: Mapped[ApplicationStatus | None] = mapped_column(str_enum(ApplicationStatus))
    to_status: Mapped[ApplicationStatus] = mapped_column(
        str_enum(ApplicationStatus), nullable=False
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )
