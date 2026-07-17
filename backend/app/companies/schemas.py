import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    website: str | None = Field(default=None, max_length=500)
    industry: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    size: str | None = Field(default=None, max_length=50)
    description: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    website: str | None = Field(default=None, max_length=500)
    industry: str | None = Field(default=None, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    size: str | None = Field(default=None, max_length=50)
    description: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    website: str | None
    industry: str | None
    location: str | None
    size: str | None
    description: str | None
    rating: int | None
    created_at: datetime
    updated_at: datetime
