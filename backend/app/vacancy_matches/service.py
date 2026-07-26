"""Queueing an analysis, for both entry points.

A user pressing "Analyze fit" and a vacancy arriving through the importer need
exactly the same checks — the only difference is what happens when a check
fails. Pressing a button deserves an explanation; an automatic run must stay
quiet, because nobody asked for a feed of failures they did not request.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.career_profiles import completeness
from app.career_profiles.models import CareerProfile
from app.career_profiles.schemas import CareerProfileData
from app.common.enums import CVExtractionStatus, MatchStatus
from app.core.config import get_settings
from app.cv_versions.models import CVVersion
from app.events.names import VACANCY_MATCH_STARTED
from app.events.service import record_event
from app.users.models import User
from app.vacancies.models import Vacancy
from app.vacancy_matches import analysis
from app.vacancy_matches.models import VacancyMatchAnalysis


class PrerequisiteError(Exception):
    """Something the user must fix before an analysis can mean anything."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class MatchInputs:
    profile: CareerProfile
    cv: CVVersion | None


def gather_inputs(
    db: Session, user: User, vacancy: Vacancy, cv_version_id: uuid.UUID | None = None
) -> MatchInputs:
    """Everything an analysis needs, or a PrerequisiteError naming what is missing."""
    if not analysis.has_usable_description(vacancy):
        raise PrerequisiteError(
            "no_description",
            "This vacancy has no description to analyse. Edit it or re-run the import.",
        )
    if user.ai_consent_at is None:
        raise PrerequisiteError(
            "no_consent", "Sending your documents to the AI provider needs your consent first"
        )

    profile = db.execute(
        select(CareerProfile).where(CareerProfile.user_id == user.id)
    ).scalar_one_or_none()
    if profile is None or profile.confirmed_at is None:
        raise PrerequisiteError(
            "profile_unconfirmed", "Confirm your career profile before analysing vacancies"
        )
    missing = completeness.missing_for_matching(
        CareerProfileData.model_validate(profile.profile_data)
    )
    if missing:
        raise PrerequisiteError(
            "profile_incomplete", f"Your career profile still needs: {', '.join(missing)}"
        )

    return MatchInputs(profile=profile, cv=_cv(db, user, cv_version_id))


def find_reusable(
    db: Session, user: User, vacancy: Vacancy, digest: str
) -> VacancyMatchAnalysis | None:
    """A finished or running analysis of exactly these inputs.

    Failures are excluded on purpose: a retry after an outage must be allowed to
    call the provider again.
    """
    return db.execute(
        select(VacancyMatchAnalysis)
        .where(
            VacancyMatchAnalysis.user_id == user.id,
            VacancyMatchAnalysis.vacancy_id == vacancy.id,
            VacancyMatchAnalysis.input_hash == digest,
            VacancyMatchAnalysis.status != MatchStatus.FAILED,
        )
        .order_by(VacancyMatchAnalysis.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def queue(
    db: Session,
    user: User,
    vacancy: Vacancy,
    inputs: MatchInputs,
    *,
    trigger: str,
    force: bool = False,
) -> tuple[VacancyMatchAnalysis, bool]:
    """Return the analysis and whether an existing one was reused."""
    digest = analysis.input_hash(
        vacancy, inputs.cv, inputs.profile.revision, get_settings().ai_model
    )
    if not force:
        existing = find_reusable(db, user, vacancy, digest)
        if existing is not None:
            return existing, True

    task = VacancyMatchAnalysis(
        user_id=user.id,
        vacancy_id=vacancy.id,
        cv_version_id=inputs.cv.id if inputs.cv else None,
        profile_revision=inputs.profile.revision,
        status=MatchStatus.PROCESSING,
        input_hash=digest,
        created_at=datetime.now(UTC),
    )
    db.add(task)
    record_event(
        db,
        VACANCY_MATCH_STARTED,
        user_id=user.id,
        properties={"trigger": trigger, "forced": force, "has_cv": inputs.cv is not None},
    )
    return task, False


def queue_after_import(db: Session, user: User, vacancy: Vacancy) -> VacancyMatchAnalysis | None:
    """Best-effort analysis of a freshly imported vacancy.

    Silent by design: a user who has not filled the profile yet is importing
    vacancies, not asking for scores, and should not be handed errors for a run
    they never requested. The manual button explains the same conditions when
    they do ask.
    """
    try:
        inputs = gather_inputs(db, user, vacancy)
    except PrerequisiteError:
        return None
    task, reused = queue(db, user, vacancy, inputs, trigger="import")
    return None if reused else task


def _cv(db: Session, user: User, cv_version_id: uuid.UUID | None) -> CVVersion | None:
    """The chosen CV, or the newest readable one when the caller did not choose."""
    if cv_version_id is None:
        return db.execute(
            select(CVVersion)
            .where(
                CVVersion.user_id == user.id,
                CVVersion.deleted_at.is_(None),
                CVVersion.extraction_status == CVExtractionStatus.COMPLETED,
            )
            .order_by(CVVersion.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()

    cv = db.execute(
        select(CVVersion).where(
            CVVersion.id == cv_version_id,
            CVVersion.user_id == user.id,
            CVVersion.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if cv is None:
        raise PrerequisiteError("cv_not_found", "CV version not found")
    if cv.extraction_status is not CVExtractionStatus.COMPLETED:
        raise PrerequisiteError(
            "cv_unreadable",
            f"No text could be read from this CV ({cv.extraction_status.value})",
        )
    return cv
