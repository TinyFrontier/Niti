import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.applications.models import Application
from app.auth.dependencies import CurrentUser, DbSession
from app.common.crud import get_owned_or_404, paginate
from app.common.enums import (
    ApplicationStatus,
    JobType,
    MatchStatus,
    MatchVerdict,
    VacancySort,
    VacancyStatus,
    VacancyTab,
    WorkFormat,
)
from app.common.normalize import normalize_text, normalize_url
from app.common.schemas import PageDep, PageOut
from app.companies.models import Company
from app.companies.service import get_or_create_company
from app.events.names import VACANCY_SAVED
from app.events.service import record_event
from app.vacancies.duplicates import check_duplicates
from app.vacancies.models import Vacancy, VacancySource
from app.vacancies.schemas import (
    CheckDuplicatesIn,
    CheckDuplicatesOut,
    VacancyCreate,
    VacancyOut,
    VacancySourceIn,
    VacancyStatsOut,
    VacancyUpdate,
)
from app.vacancies.status import application_statuses_for
from app.vacancy_matches.models import VacancyMatchAnalysis

router = APIRouter()


def _resolve_company_id(
    db, user_id: uuid.UUID, company_id: uuid.UUID | None, company_name: str | None
) -> uuid.UUID | None:
    if company_id is not None:
        return get_owned_or_404(db, Company, company_id, user_id).id
    if company_name:
        return get_or_create_company(db, user_id, company_name).id
    return None


def _build_sources(sources: list[VacancySourceIn]) -> list[VacancySource]:
    return [
        VacancySource(
            platform=s.platform,
            url=s.url,
            normalized_url=normalize_url(s.url) if s.url else None,
            external_id=s.external_id,
        )
        for s in sources
    ]


def _loaded(stmt):
    return stmt.options(
        selectinload(Vacancy.company),
        selectinload(Vacancy.sources),
        selectinload(Vacancy.applications),
    )


# status of the newest live application, or NULL when the vacancy has none
_LATEST_APPLICATION_STATUS = (
    select(Application.status)
    .where(Application.vacancy_id == Vacancy.id, Application.deleted_at.is_(None))
    .order_by(Application.created_at.desc())
    .limit(1)
    .correlate(Vacancy)
    .scalar_subquery()
)

_TAB_CONDITIONS = {
    VacancyTab.ARCHIVED: lambda: Vacancy.archived_at.is_not(None),
    VacancyTab.SAVED: lambda: Vacancy.archived_at.is_(None)
    & (
        _LATEST_APPLICATION_STATUS.is_(None)
        | (_LATEST_APPLICATION_STATUS == ApplicationStatus.SAVED)
    ),
    VacancyTab.APPLIED: lambda: Vacancy.archived_at.is_(None)
    & _LATEST_APPLICATION_STATUS.is_not(None)
    & (_LATEST_APPLICATION_STATUS != ApplicationStatus.SAVED),
}


def _status_condition(vacancy_status: VacancyStatus):
    """Filter on the derived status; mirrors Vacancy.status, archiving first."""
    if vacancy_status is VacancyStatus.ARCHIVED:
        return Vacancy.archived_at.is_not(None)
    matching = application_statuses_for(vacancy_status)
    condition = _LATEST_APPLICATION_STATUS.in_(matching)
    if vacancy_status is VacancyStatus.SAVED:
        condition = condition | _LATEST_APPLICATION_STATUS.is_(None)
    return Vacancy.archived_at.is_(None) & condition


def _latest_match(column):
    """That column from the newest completed analysis of each vacancy.

    Same shape as `_LATEST_APPLICATION_STATUS`: a correlated scalar subquery, so
    filtering and sorting on the fit stays one statement instead of a join that
    would multiply rows by the analysis history.
    """
    return (
        select(column)
        .where(
            VacancyMatchAnalysis.vacancy_id == Vacancy.id,
            VacancyMatchAnalysis.status == MatchStatus.COMPLETED,
        )
        .order_by(VacancyMatchAnalysis.created_at.desc())
        .limit(1)
        .correlate(Vacancy)
        .scalar_subquery()
    )


_LATEST_MATCH_VERDICT = _latest_match(VacancyMatchAnalysis.verdict)
_LATEST_MATCH_SCORE = _latest_match(VacancyMatchAnalysis.score)

_SORT_CLAUSES = {
    VacancySort.NEWEST: lambda: (Vacancy.created_at.desc(),),
    VacancySort.OLDEST: lambda: (Vacancy.created_at.asc(),),
    VacancySort.TITLE: lambda: (Vacancy.title.asc(),),
    VacancySort.COMPANY: lambda: (Company.name.asc().nulls_last(),),
    # unanalysed vacancies sink to the bottom rather than reading as a zero
    VacancySort.FIT: lambda: (
        _LATEST_MATCH_SCORE.desc().nulls_last(),
        Vacancy.created_at.desc(),
    ),
}


def _filtered_stmt(
    user_id: uuid.UUID,
    search: str | None,
    work_format: WorkFormat | None,
    job_type: JobType | None,
    company_id: uuid.UUID | None,
    verdict: MatchVerdict | None = None,
):
    """Everything except the tab/archived split, which the counters vary over."""
    stmt = (
        select(Vacancy)
        .outerjoin(Company, Vacancy.company_id == Company.id)
        .where(Vacancy.user_id == user_id, Vacancy.deleted_at.is_(None))
    )
    if search:
        stmt = stmt.where(
            Vacancy.title.ilike(f"%{search}%") | Company.name.ilike(f"%{search}%")
        )
    if work_format is not None:
        stmt = stmt.where(Vacancy.work_format == work_format)
    if job_type is not None:
        stmt = stmt.where(Vacancy.job_type == job_type)
    if company_id is not None:
        stmt = stmt.where(Vacancy.company_id == company_id)
    if verdict is not None:
        stmt = stmt.where(_LATEST_MATCH_VERDICT == verdict)
    return stmt


@router.get("", response_model=PageOut[VacancyOut])
def list_vacancies(
    current_user: CurrentUser,
    db: DbSession,
    params: PageDep,
    search: str | None = None,
    work_format: WorkFormat | None = None,
    job_type: JobType | None = None,
    company_id: uuid.UUID | None = None,
    archived: bool = False,
    tab: VacancyTab | None = None,
    vacancy_status: Annotated[VacancyStatus | None, Query(alias="status")] = None,
    verdict: MatchVerdict | None = None,
    sort: VacancySort = VacancySort.NEWEST,
) -> PageOut:
    stmt = _loaded(
        _filtered_stmt(current_user.id, search, work_format, job_type, company_id, verdict)
    )
    if vacancy_status is not None:
        stmt = stmt.where(_status_condition(vacancy_status))
    if tab is not None:
        condition = _TAB_CONDITIONS.get(tab)
        if condition is not None:
            stmt = stmt.where(condition())
    else:
        stmt = stmt.where(
            Vacancy.archived_at.is_not(None) if archived else Vacancy.archived_at.is_(None)
        )
    stmt = stmt.order_by(*_SORT_CLAUSES[sort]())
    items, total = paginate(db, stmt, params.page, params.page_size)
    return PageOut(items=items, total=total, page=params.page, page_size=params.page_size)


@router.get("/stats", response_model=VacancyStatsOut)
def vacancy_stats(
    current_user: CurrentUser,
    db: DbSession,
    search: str | None = None,
    work_format: WorkFormat | None = None,
    job_type: JobType | None = None,
    company_id: uuid.UUID | None = None,
    verdict: MatchVerdict | None = None,
) -> VacancyStatsOut:
    base = _filtered_stmt(current_user.id, search, work_format, job_type, company_id, verdict)

    def count(condition=None) -> int:
        stmt = base if condition is None else base.where(condition)
        return db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    return VacancyStatsOut(
        all=count(),
        saved=count(_TAB_CONDITIONS[VacancyTab.SAVED]()),
        applied=count(_TAB_CONDITIONS[VacancyTab.APPLIED]()),
        archived=count(_TAB_CONDITIONS[VacancyTab.ARCHIVED]()),
    )


@router.post("", response_model=VacancyOut, status_code=status.HTTP_201_CREATED)
def create_vacancy(data: VacancyCreate, current_user: CurrentUser, db: DbSession) -> Vacancy:
    vacancy = Vacancy(
        user_id=current_user.id,
        company_id=_resolve_company_id(db, current_user.id, data.company_id, data.company_name),
        title=data.title,
        normalized_title=normalize_text(data.title),
        description=data.description,
        url=data.url,
        normalized_url=normalize_url(data.url) if data.url else None,
        location=data.location,
        salary=data.salary,
        work_format=data.work_format,
        job_type=data.job_type,
        sources=_build_sources(data.sources),
    )
    db.add(vacancy)
    record_event(db, VACANCY_SAVED, user_id=current_user.id, properties={"source": "manual"})
    db.commit()
    return _get_loaded(db, vacancy.id, current_user.id)


def _get_loaded(db, vacancy_id: uuid.UUID, user_id: uuid.UUID) -> Vacancy:
    vacancy = db.scalar(
        _loaded(
            select(Vacancy).where(
                Vacancy.id == vacancy_id,
                Vacancy.user_id == user_id,
                Vacancy.deleted_at.is_(None),
            )
        )
    )
    if vacancy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Vacancy not found")
    return vacancy


@router.post("/check-duplicates", response_model=CheckDuplicatesOut)
def check_vacancy_duplicates(
    data: CheckDuplicatesIn, current_user: CurrentUser, db: DbSession
) -> CheckDuplicatesOut:
    candidates = check_duplicates(
        db,
        user_id=current_user.id,
        title=data.title,
        company_name=data.company_name,
        url=data.url,
        exclude_id=data.exclude_id,
    )
    return CheckDuplicatesOut(candidates=candidates)


@router.get("/{vacancy_id}", response_model=VacancyOut)
def get_vacancy(vacancy_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Vacancy:
    return _get_loaded(db, vacancy_id, current_user.id)


@router.patch("/{vacancy_id}", response_model=VacancyOut)
def update_vacancy(
    vacancy_id: uuid.UUID, data: VacancyUpdate, current_user: CurrentUser, db: DbSession
) -> Vacancy:
    vacancy = get_owned_or_404(db, Vacancy, vacancy_id, current_user.id)
    updates = data.model_dump(exclude_unset=True)

    if "company_id" in updates or "company_name" in updates:
        vacancy.company_id = _resolve_company_id(
            db, current_user.id, updates.pop("company_id", None), updates.pop("company_name", None)
        )
    if "title" in updates:
        updates["normalized_title"] = normalize_text(updates["title"])
    if "url" in updates:
        updates["normalized_url"] = normalize_url(updates["url"]) if updates["url"] else None
    if "sources" in updates:
        updates.pop("sources")
        vacancy.sources = _build_sources(data.sources or [])

    for key, value in updates.items():
        setattr(vacancy, key, value)
    db.commit()
    return _get_loaded(db, vacancy.id, current_user.id)


@router.post("/{vacancy_id}/archive", response_model=VacancyOut)
def archive_vacancy(vacancy_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Vacancy:
    vacancy = get_owned_or_404(db, Vacancy, vacancy_id, current_user.id)
    vacancy.archived_at = datetime.now(UTC)
    db.commit()
    return _get_loaded(db, vacancy.id, current_user.id)


@router.post("/{vacancy_id}/unarchive", response_model=VacancyOut)
def unarchive_vacancy(vacancy_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Vacancy:
    vacancy = get_owned_or_404(db, Vacancy, vacancy_id, current_user.id)
    vacancy.archived_at = None
    db.commit()
    return _get_loaded(db, vacancy.id, current_user.id)


@router.delete("/{vacancy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vacancy(vacancy_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    vacancy = get_owned_or_404(db, Vacancy, vacancy_id, current_user.id)
    vacancy.deleted_at = datetime.now(UTC)
    db.commit()
