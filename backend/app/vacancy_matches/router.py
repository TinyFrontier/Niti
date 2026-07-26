"""Match endpoints.

The POST only queues: a run takes tens of seconds, so it answers 202 with a row
the client polls. Identical inputs reuse the finished result instead of paying
the provider again — that is what `input_hash` is for.
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.auth.dependencies import CurrentUser, DbSession
from app.career_profiles import completeness
from app.career_profiles.models import CareerProfile
from app.career_profiles.schemas import CareerProfileData
from app.common.crud import get_owned_or_404
from app.common.enums import CVExtractionStatus, MatchStatus
from app.core.config import get_settings
from app.cv_versions.models import CVVersion
from app.events.names import VACANCY_MATCH_STARTED
from app.events.service import record_event
from app.users.models import User
from app.vacancies.models import Vacancy
from app.vacancy_matches import analysis
from app.vacancy_matches.models import VacancyMatchAnalysis
from app.vacancy_matches.schemas import MatchAnalysisOut, MatchRequest

router = APIRouter()
vacancy_router = APIRouter()


@vacancy_router.post(
    "/{vacancy_id}/match", response_model=MatchAnalysisOut, status_code=status.HTTP_202_ACCEPTED
)
def request_match(
    vacancy_id: uuid.UUID,
    payload: MatchRequest,
    current_user: CurrentUser,
    db: DbSession,
    response: Response,
) -> MatchAnalysisOut:
    vacancy = get_owned_or_404(db, Vacancy, vacancy_id, current_user.id)
    if not analysis.has_usable_description(vacancy):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="This vacancy has no description to analyse. Edit it or re-run the import.",
        )

    profile_row, profile = _ready_profile(db, current_user)
    cv = _chosen_cv(db, current_user, payload.cv_version_id)
    if current_user.ai_consent_at is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Sending your documents to the AI provider needs your consent first",
        )

    digest = analysis.input_hash(vacancy, cv, profile_row.revision, get_settings().ai_model)
    if not payload.force:
        existing = db.execute(
            select(VacancyMatchAnalysis)
            .where(
                VacancyMatchAnalysis.user_id == current_user.id,
                VacancyMatchAnalysis.vacancy_id == vacancy.id,
                VacancyMatchAnalysis.input_hash == digest,
                VacancyMatchAnalysis.status != MatchStatus.FAILED,
            )
            .order_by(VacancyMatchAnalysis.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        if existing is not None:
            # nothing changed, so the previous answer is still the answer
            if existing.status is MatchStatus.COMPLETED:
                response.status_code = status.HTTP_200_OK
            return _as_out(db, existing, vacancy, profile_row.revision)

    task = VacancyMatchAnalysis(
        user_id=current_user.id,
        vacancy_id=vacancy.id,
        cv_version_id=cv.id if cv else None,
        profile_revision=profile_row.revision,
        status=MatchStatus.PROCESSING,
        input_hash=digest,
        created_at=datetime.now(UTC),
    )
    db.add(task)
    record_event(
        db,
        VACANCY_MATCH_STARTED,
        user_id=current_user.id,
        properties={"forced": payload.force, "has_cv": cv is not None},
    )
    db.commit()
    db.refresh(task)
    return _as_out(db, task, vacancy, profile_row.revision)


@vacancy_router.get("/{vacancy_id}/matches", response_model=list[MatchAnalysisOut])
def list_matches(
    vacancy_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[MatchAnalysisOut]:
    vacancy = get_owned_or_404(db, Vacancy, vacancy_id, current_user.id)
    rows = db.execute(
        select(VacancyMatchAnalysis)
        .where(
            VacancyMatchAnalysis.user_id == current_user.id,
            VacancyMatchAnalysis.vacancy_id == vacancy.id,
        )
        .order_by(VacancyMatchAnalysis.created_at.desc())
    ).scalars()
    revision = _profile_revision(db, current_user)
    return [_as_out(db, row, vacancy, revision) for row in rows]


@vacancy_router.get("/{vacancy_id}/matches/latest", response_model=MatchAnalysisOut)
def latest_match(
    vacancy_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> MatchAnalysisOut:
    vacancy = get_owned_or_404(db, Vacancy, vacancy_id, current_user.id)
    row = db.execute(
        select(VacancyMatchAnalysis)
        .where(
            VacancyMatchAnalysis.user_id == current_user.id,
            VacancyMatchAnalysis.vacancy_id == vacancy.id,
        )
        .order_by(VacancyMatchAnalysis.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="This vacancy has not been analysed")
    return _as_out(db, row, vacancy, _profile_revision(db, current_user))


@router.get("/{analysis_id}", response_model=MatchAnalysisOut)
def get_match(analysis_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> MatchAnalysisOut:
    row = get_owned_or_404(db, VacancyMatchAnalysis, analysis_id, current_user.id)
    vacancy = db.get(Vacancy, row.vacancy_id)
    return _as_out(db, row, vacancy, _profile_revision(db, current_user))


def _ready_profile(db: DbSession, user: User) -> tuple[CareerProfile, CareerProfileData]:
    row = db.execute(
        select(CareerProfile).where(CareerProfile.user_id == user.id)
    ).scalar_one_or_none()
    if row is None or row.confirmed_at is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Confirm your career profile before analysing vacancies",
        )
    data = CareerProfileData.model_validate(row.profile_data)
    missing = completeness.missing_for_matching(data)
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Your career profile still needs: {', '.join(missing)}",
        )
    return row, data


def _chosen_cv(db: DbSession, user: User, cv_version_id: uuid.UUID | None) -> CVVersion | None:
    """The picked CV, or the newest readable one when the client did not choose."""
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

    cv = get_owned_or_404(db, CVVersion, cv_version_id, user.id)
    if cv.extraction_status is not CVExtractionStatus.COMPLETED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"No text could be read from this CV ({cv.extraction_status.value})",
        )
    return cv


def _profile_revision(db: DbSession, user: User) -> int | None:
    row = db.execute(
        select(CareerProfile).where(CareerProfile.user_id == user.id)
    ).scalar_one_or_none()
    return row.revision if row else None


def _as_out(
    db: DbSession,
    row: VacancyMatchAnalysis,
    vacancy: Vacancy | None,
    profile_revision: int | None,
) -> MatchAnalysisOut:
    """Recompute the hash for this row's own inputs to see if it still holds.

    The comparison has to use the CV the analysis actually ran on, not the
    current default: swapping the selected CV produces a different analysis, not
    a stale one.
    """
    out = MatchAnalysisOut.model_validate(row)
    if row.status is not MatchStatus.COMPLETED or vacancy is None or profile_revision is None:
        return out
    cv = db.get(CVVersion, row.cv_version_id) if row.cv_version_id else None
    current = analysis.input_hash(vacancy, cv, profile_revision, get_settings().ai_model)
    out.is_stale = row.input_hash != current
    return out
