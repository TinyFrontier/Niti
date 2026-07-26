"""The career profile is stored as JSONB, so this schema is the only thing
standing between the column and whatever a model or a client sends.

`extra="forbid"` is deliberate: a drafting model that invents a field should
fail validation and get one corrective retry, not quietly widen the profile.
List lengths are bounded for the same reason.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.common.enums import (
    LanguageLevel,
    ProfileFieldSource,
    Relocation,
    SalaryPeriod,
    Seniority,
    SkillLevel,
    WorkFormat,
)

_STRICT = ConfigDict(extra="forbid")


class SkillItem(BaseModel):
    model_config = _STRICT

    name: str = Field(min_length=1, max_length=80)
    level: SkillLevel | None = None
    years: float | None = Field(default=None, ge=0, le=60)


class AreaExperience(BaseModel):
    model_config = _STRICT

    area: str = Field(min_length=1, max_length=120)
    years: float = Field(ge=0, le=60)


class LanguageItem(BaseModel):
    model_config = _STRICT

    language: str = Field(min_length=1, max_length=60)
    level: LanguageLevel


class SalaryExpectation(BaseModel):
    model_config = _STRICT

    min_amount: int | None = Field(default=None, ge=0, le=100_000_000)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    period: SalaryPeriod | None = None

    @field_validator("currency")
    @classmethod
    def _upper(cls, value: str | None) -> str | None:
        return value.upper() if value else value


class CareerProfileData(BaseModel):
    """Source of truth for the user's preferences and constraints."""

    model_config = _STRICT

    target_roles: list[str] = Field(default_factory=list, max_length=10)
    seniority: Seniority | None = None
    core_skills: list[SkillItem] = Field(default_factory=list, max_length=40)
    additional_skills: list[SkillItem] = Field(default_factory=list, max_length=60)
    total_experience_years: float | None = Field(default=None, ge=0, le=60)
    relevant_experience: list[AreaExperience] = Field(default_factory=list, max_length=15)

    current_location: str | None = Field(default=None, max_length=160)
    allowed_countries: list[str] = Field(default_factory=list, max_length=40)
    allowed_timezones: list[str] = Field(default_factory=list, max_length=20)
    work_formats: list[WorkFormat] = Field(default_factory=list, max_length=4)
    relocation: Relocation | None = None

    salary: SalaryExpectation | None = None
    languages: list[LanguageItem] = Field(default_factory=list, max_length=15)
    work_authorization: list[str] = Field(default_factory=list, max_length=10)

    preferred_domains: list[str] = Field(default_factory=list, max_length=15)
    avoided_domains: list[str] = Field(default_factory=list, max_length=15)
    hard_constraints: list[str] = Field(default_factory=list, max_length=15)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator(
        "target_roles",
        "allowed_countries",
        "allowed_timezones",
        "work_authorization",
        "preferred_domains",
        "avoided_domains",
        "hard_constraints",
        mode="after",
    )
    @classmethod
    def _clean(cls, values: list[str]) -> list[str]:
        """Drop blanks and duplicates a model or a form can produce."""
        seen: dict[str, None] = {}
        for value in values:
            stripped = value.strip()[:160]
            if stripped:
                seen.setdefault(stripped, None)
        return list(seen)


class CareerProfileUpdate(BaseModel):
    """Full replacement of the profile payload."""

    model_config = _STRICT

    data: CareerProfileData


class CareerProfilePatch(BaseModel):
    """One wizard step: only the keys present are replaced."""

    model_config = _STRICT

    data: dict = Field(default_factory=dict)


class CareerProfileOut(BaseModel):
    data: CareerProfileData
    revision: int
    confirmed_at: datetime | None
    updated_at: datetime | None
    completeness: int
    is_ready_for_matching: bool
    # human-readable labels of what blocks matching, for the UI and for API errors
    missing_for_matching: list[str]


class ProfileDraftIn(BaseModel):
    model_config = _STRICT

    cv_version_id: uuid.UUID | None = None
    free_text: str | None = Field(default=None, max_length=8000)


class ProfileDraftOut(BaseModel):
    data: CareerProfileData
    # field name -> where the value came from; absent means the model left it empty
    sources: dict[str, ProfileFieldSource]
