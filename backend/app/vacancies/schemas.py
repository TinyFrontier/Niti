import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.common.enums import JobType, WorkFormat
from app.companies.schemas import CompanyOut


class VacancySourceIn(BaseModel):
    platform: str = Field(min_length=1, max_length=50)
    url: str | None = Field(default=None, max_length=1000)
    external_id: str | None = Field(default=None, max_length=255)


class VacancySourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    platform: str
    url: str | None
    external_id: str | None


class VacancyCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    # either link an existing company or pass a name to get-or-create one
    company_id: uuid.UUID | None = None
    company_name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    url: str | None = Field(default=None, max_length=1000)
    location: str | None = Field(default=None, max_length=255)
    salary: str | None = Field(default=None, max_length=255)
    work_format: WorkFormat = WorkFormat.UNKNOWN
    job_type: JobType = JobType.UNKNOWN
    sources: list[VacancySourceIn] = []


class VacancyUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    company_id: uuid.UUID | None = None
    company_name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    url: str | None = Field(default=None, max_length=1000)
    location: str | None = Field(default=None, max_length=255)
    salary: str | None = Field(default=None, max_length=255)
    work_format: WorkFormat | None = None
    job_type: JobType | None = None
    sources: list[VacancySourceIn] | None = None


class VacancyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    url: str | None
    location: str | None
    salary: str | None
    work_format: WorkFormat
    job_type: JobType
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    company: CompanyOut | None
    sources: list[VacancySourceOut]


class CheckDuplicatesIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    url: str | None = Field(default=None, max_length=1000)
    # when editing an existing vacancy, exclude it from candidates
    exclude_id: uuid.UUID | None = None


class DuplicateCandidateOut(BaseModel):
    vacancy_id: uuid.UUID
    title: str
    company_name: str | None
    url: str | None
    score: float
    reason: str  # url_match | exact_match | fuzzy_match


class CheckDuplicatesOut(BaseModel):
    candidates: list[DuplicateCandidateOut]
