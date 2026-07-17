import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.common.enums import ApplicationStatus
from app.cv_versions.schemas import CVVersionOut
from app.vacancies.schemas import VacancyOut


class ApplicationCreate(BaseModel):
    vacancy_id: uuid.UUID
    cv_version_id: uuid.UUID | None = None
    status: ApplicationStatus = ApplicationStatus.APPLIED
    applied_at: date | None = None
    source: str | None = Field(default=None, max_length=50)
    notes: str | None = None


class ApplicationUpdate(BaseModel):
    cv_version_id: uuid.UUID | None = None
    status: ApplicationStatus | None = None
    applied_at: date | None = None
    source: str | None = Field(default=None, max_length=50)
    notes: str | None = None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: ApplicationStatus
    applied_at: date | None
    source: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    vacancy: VacancyOut
    cv_version: CVVersionOut | None
