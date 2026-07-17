import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import JobType, WorkFormat
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
    from app.companies.models import Company


class Vacancy(UUIDPkMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "vacancies"
    __table_args__ = (Index("ix_vacancies_user_normalized_title", "user_id", "normalized_title"),)

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(1000))
    normalized_url: Mapped[str | None] = mapped_column(String(1000), index=True)
    location: Mapped[str | None] = mapped_column(String(255))
    salary: Mapped[str | None] = mapped_column(String(255))
    work_format: Mapped[WorkFormat] = mapped_column(
        str_enum(WorkFormat), default=WorkFormat.UNKNOWN, nullable=False
    )
    job_type: Mapped[JobType] = mapped_column(
        str_enum(JobType), default=JobType.UNKNOWN, nullable=False
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    company: Mapped["Company | None"] = relationship(back_populates="vacancies")
    sources: Mapped[list["VacancySource"]] = relationship(
        back_populates="vacancy", cascade="all, delete-orphan"
    )
    applications: Mapped[list["Application"]] = relationship(back_populates="vacancy")


class VacancySource(UUIDPkMixin, TimestampMixin, Base):
    """One vacancy can be found on several platforms (hh, LinkedIn, company site...)."""

    __tablename__ = "vacancy_sources"

    vacancy_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vacancies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    url: Mapped[str | None] = mapped_column(String(1000))
    normalized_url: Mapped[str | None] = mapped_column(String(1000), index=True)
    external_id: Mapped[str | None] = mapped_column(String(255))

    vacancy: Mapped["Vacancy"] = relationship(back_populates="sources")
