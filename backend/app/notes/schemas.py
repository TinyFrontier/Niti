import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.common.enums import EntityType


class NoteCreate(BaseModel):
    entity_type: EntityType
    entity_id: uuid.UUID
    title: str | None = Field(default=None, max_length=255)
    body: str = Field(min_length=1)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    body: str | None = Field(default=None, min_length=1)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: EntityType
    entity_id: uuid.UUID
    title: str | None
    body: str
    created_at: datetime
    updated_at: datetime
