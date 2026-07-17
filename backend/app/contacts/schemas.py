import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.common.enums import (
    CommunicationChannel,
    CommunicationDirection,
    ContactStatus,
    ContactType,
)
from app.companies.schemas import CompanyOut


class ContactCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    contact_type: ContactType = ContactType.OTHER
    status: ContactStatus = ContactStatus.NEW
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    telegram: str | None = Field(default=None, max_length=100)
    linkedin_url: str | None = Field(default=None, max_length=500)
    position: str | None = Field(default=None, max_length=255)
    company_id: uuid.UUID | None = None


class ContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    contact_type: ContactType | None = None
    status: ContactStatus | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    telegram: str | None = Field(default=None, max_length=100)
    linkedin_url: str | None = Field(default=None, max_length=500)
    position: str | None = Field(default=None, max_length=255)
    company_id: uuid.UUID | None = None


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str | None
    contact_type: ContactType
    status: ContactStatus
    email: str | None
    phone: str | None
    telegram: str | None
    linkedin_url: str | None
    position: str | None
    company: CompanyOut | None
    created_at: datetime
    updated_at: datetime


class CommunicationLogCreate(BaseModel):
    channel: CommunicationChannel
    direction: CommunicationDirection
    subject: str | None = Field(default=None, max_length=500)
    body: str | None = None
    occurred_at: datetime
    next_follow_up_at: datetime | None = None
    application_id: uuid.UUID | None = None


class CommunicationLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel: CommunicationChannel
    direction: CommunicationDirection
    subject: str | None
    body: str | None
    occurred_at: datetime
    next_follow_up_at: datetime | None
    application_id: uuid.UUID | None
    created_at: datetime
