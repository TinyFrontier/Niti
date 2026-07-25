import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.common.enums import JobType, WorkFormat
from app.vacancies.schemas import DuplicateCandidateOut


class PreviewIn(BaseModel):
    url: str = Field(min_length=1, max_length=1000)


class PreviewFieldsOut(BaseModel):
    title: str | None = None
    company_name: str | None = None
    location: str | None = None
    salary: str | None = None
    work_format: str | None = None
    job_type: str | None = None
    description: str | None = None


class PreviewOut(BaseModel):
    url: str
    normalized_url: str
    platform: str
    extraction_method: str  # json_ld | open_graph | adapter | none
    fields: PreviewFieldsOut
    warnings: list[str]
    duplicates: list[DuplicateCandidateOut]


class VacancyFieldsIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    salary: str | None = Field(default=None, max_length=255)
    work_format: WorkFormat = WorkFormat.UNKNOWN
    job_type: JobType = JobType.UNKNOWN
    description: str | None = None


class DuplicateActionIn(BaseModel):
    vacancy_id: uuid.UUID
    action: Literal["add_source"]


class CommitIn(BaseModel):
    url: str = Field(min_length=1, max_length=1000)
    platform: str = Field(min_length=1, max_length=50)
    mode: Literal["save", "applied"]
    fields: VacancyFieldsIn
    duplicate_action: DuplicateActionIn | None = None


class CommitOut(BaseModel):
    vacancy_id: uuid.UUID
    application_id: uuid.UUID | None
    deduplicated: bool
