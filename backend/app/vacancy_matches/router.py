"""Match endpoints.

The POST only queues: a run takes tens of seconds, so it answers 202 with a row
the client polls. Identical inputs reuse the finished result instead of paying
the provider again — that is what `input_hash` is for.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select

from app.auth.dependencies import CurrentUser, DbSession
from app.career_profiles.models import CareerProfile
from app.common.crud import get_owned_or_404
from app.common.enums import MatchStatus
from app.core.config import get_settings
from app.cv_versions.models import CVVersion
from app.users.models import User
from app.vacancies.models import Vacancy
from app.vacancy_matches import analysis, service
from app.vacancy_matches.models import VacancyMatchAnalysis
from app.vacancy_matches.schemas import MatchAnalysisOut, MatchRequest, MatchSummaryOut

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
    subject = analysis.MatchSubject.from_vacancy(vacancy)
    try:
        inputs = service.gather_inputs(db, current_user, subject, payload.cv_version_id)
    except service.PrerequisiteError as error:
        # asking explicitly earns an explanation, unlike the silent import path
        code = (
            status.HTTP_403_FORBIDDEN
            if error.code == "no_consent"
            else status.HTTP_404_NOT_FOUND
            if error.code == "cv_not_found"
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(code, detail=error.message) from error

    task, reused = service.queue(
        db,
        current_user,
        subject,
        inputs,
        trigger="manual",
        vacancy_id=vacancy.id,
        force=payload.force,
    )
    db.commit()
    db.refresh(task)
    if reused and task.status is MatchStatus.COMPLETED:
        # nothing changed, so the previous answer is still the answer
        response.status_code = status.HTTP_200_OK
    return _as_out(db, task, vacancy, inputs.profile.revision)


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


@router.get("/summary", response_model=list[MatchSummaryOut])
def match_summaries(
    current_user: CurrentUser, db: DbSession, vacancy_ids: Annotated[list[uuid.UUID], Query()]
) -> list[MatchSummaryOut]:
    """Latest analysis per vacancy, for badges in a list.

    One `DISTINCT ON` instead of a request per row: a list page would otherwise
    fan out into as many round trips as it has vacancies.
    """
    if not vacancy_ids:
        return []
    rows = db.execute(
        select(VacancyMatchAnalysis)
        .where(
            VacancyMatchAnalysis.user_id == current_user.id,
            VacancyMatchAnalysis.vacancy_id.in_(vacancy_ids[:100]),
        )
        .distinct(VacancyMatchAnalysis.vacancy_id)
        .order_by(VacancyMatchAnalysis.vacancy_id, VacancyMatchAnalysis.created_at.desc())
    ).scalars()

    revision = _profile_revision(db, current_user)
    vacancies = {
        vacancy.id: vacancy
        for vacancy in db.execute(
            select(Vacancy).where(
                Vacancy.user_id == current_user.id, Vacancy.id.in_(vacancy_ids[:100])
            )
        ).scalars()
    }
    return [
        MatchSummaryOut(
            vacancy_id=row.vacancy_id,
            status=row.status,
            score=row.score,
            verdict=row.verdict,
            confidence=row.confidence,
            is_stale=_as_out(db, row, vacancies.get(row.vacancy_id), revision).is_stale,
        )
        for row in rows
    ]


@router.get("/{analysis_id}", response_model=MatchAnalysisOut)
def get_match(analysis_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> MatchAnalysisOut:
    row = get_owned_or_404(db, VacancyMatchAnalysis, analysis_id, current_user.id)
    # a preview's analysis has no vacancy behind it until the import is committed
    vacancy = db.get(Vacancy, row.vacancy_id) if row.vacancy_id else None
    return _as_out(db, row, vacancy, _profile_revision(db, current_user))


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
    current = analysis.input_hash(
        analysis.MatchSubject.from_vacancy(vacancy),
        cv,
        profile_revision,
        get_settings().match_model(),
    )
    out.is_stale = row.input_hash != current
    return out
