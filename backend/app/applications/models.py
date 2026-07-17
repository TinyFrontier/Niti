import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, String, Text
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
