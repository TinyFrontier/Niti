import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CVVersionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    language: str | None = Field(default=None, max_length=16)
    specialization: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class CVVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    language: str | None
    specialization: str | None
    file_name: str
    file_size: int | None
    mime_type: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
