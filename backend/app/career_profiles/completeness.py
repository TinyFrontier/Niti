"""How complete a profile is, and whether it can carry a job match.

Two different questions. `completeness` drives a progress bar and a nudge, so it
counts every field worth filling. `is_ready_for_matching` gates the analysis, so
it lists only fields without which a verdict would be guesswork — and names the
missing ones, because "profile incomplete" is not an actionable error.
"""

from collections.abc import Callable

from app.career_profiles.schemas import CareerProfileData

# (label, is_filled) — label is shown to the user, so keep it a plain noun phrase
_REQUIRED: list[tuple[str, Callable[[CareerProfileData], bool]]] = [
    ("Target roles", lambda d: bool(d.target_roles)),
    ("Seniority", lambda d: d.seniority is not None),
    ("At least 3 core skills", lambda d: len(d.core_skills) >= 3),
    ("Current location", lambda d: bool(d.current_location)),
    ("Work format", lambda d: bool(d.work_formats)),
    ("Languages", lambda d: bool(d.languages)),
]

_OPTIONAL: list[Callable[[CareerProfileData], bool]] = [
    lambda d: d.total_experience_years is not None,
    lambda d: bool(d.additional_skills),
    lambda d: bool(d.relevant_experience),
    lambda d: bool(d.allowed_countries or d.allowed_timezones),
    lambda d: d.relocation is not None,
    lambda d: d.salary is not None and d.salary.min_amount is not None,
    lambda d: bool(d.work_authorization),
    lambda d: bool(d.preferred_domains or d.avoided_domains),
    lambda d: bool(d.hard_constraints),
]


def missing_for_matching(data: CareerProfileData) -> list[str]:
    return [label for label, filled in _REQUIRED if not filled(data)]


def is_ready_for_matching(data: CareerProfileData) -> bool:
    return not missing_for_matching(data)


def completeness(data: CareerProfileData) -> int:
    """Percentage, with the matching-critical fields weighted double."""
    earned = sum(2 for _, filled in _REQUIRED if filled(data))
    earned += sum(1 for filled in _OPTIONAL if filled(data))
    total = len(_REQUIRED) * 2 + len(_OPTIONAL)
    return round(earned * 100 / total)
