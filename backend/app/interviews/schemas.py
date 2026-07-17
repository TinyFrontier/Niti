import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.applications.schemas import ApplicationOut
from app.common.enums import InterviewFormat, InterviewResult


class InterviewCreate(BaseModel):
    application_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int | None = Field(default=None, ge=1, le=600)
    format: InterviewFormat = InterviewFormat.VIDEO
    location_or_link: str | None = Field(default=None, max_length=500)
    participants: str | None = None
    notes: str | None = None
    result: InterviewResult | None = None


class InterviewUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=600)
    format: InterviewFormat | None = None
    location_or_link: str | None = Field(default=None, max_length=500)
    participants: str | None = None
    notes: str | None = None
    result: InterviewResult | None = None


class InterviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int | None
    format: InterviewFormat
    location_or_link: str | None
    participants: str | None
    notes: str | None
    result: InterviewResult | None
    created_at: datetime
    application: ApplicationOut
