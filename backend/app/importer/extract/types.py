"""Shared result type for all extraction layers."""

from dataclasses import dataclass
from dataclasses import fields as dataclass_fields


@dataclass
class ExtractedFields:
    title: str | None = None
    company_name: str | None = None
    location: str | None = None
    salary: str | None = None
    # values of app.common.enums.WorkFormat / JobType, kept as plain strings here
    work_format: str | None = None
    job_type: str | None = None
    description: str | None = None


def merge(base: ExtractedFields, patch: ExtractedFields) -> ExtractedFields:
    """Return a copy of `base` where only missing fields are filled from `patch`."""
    return ExtractedFields(
        **{
            f.name: getattr(base, f.name) or getattr(patch, f.name)
            for f in dataclass_fields(ExtractedFields)
        }
    )
