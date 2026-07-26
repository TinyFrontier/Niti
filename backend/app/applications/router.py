import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.applications.models import Application, ApplicationStatusHistory
from app.applications.schemas import (
    ApplicationCreate,
    ApplicationOut,
    ApplicationUpdate,
    StatusHistoryOut,
)
from app.applications.service import record_status_change
from app.auth.dependencies import CurrentUser, DbSession
from app.common.crud import get_owned_or_404, paginate
from app.common.enums import ApplicationStatus
from app.common.schemas import PageDep, PageOut
from app.companies.models import Company
from app.cv_versions.models import CVVersion
from app.events.names import APPLICATION_CREATED
from app.events.service import record_event
from app.vacancies.models import Vacancy

router = APIRouter()


def _loaded(stmt):
    return stmt.options(
        selectinload(Application.vacancy).selectinload(Vacancy.company),
        selectinload(Application.vacancy).selectinload(Vacancy.sources),
        # VacancyOut.status derives from these
        selectinload(Application.vacancy).selectinload(Vacancy.applications),
        selectinload(Application.cv_version),
    )


def _get_loaded(db, application_id: uuid.UUID, user_id: uuid.UUID) -> Application:
    application = db.scalar(
        _loaded(
            select(Application).where(
                Application.id == application_id,
                Application.user_id == user_id,
                Application.deleted_at.is_(None),
            )
        )
    )
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Application not found")
    return application


@router.get("", response_model=PageOut[ApplicationOut])
def list_applications(
    current_user: CurrentUser,
    db: DbSession,
    params: PageDep,
    search: str | None = None,
    application_status: Annotated[
        ApplicationStatus | None, Query(alias="status")
    ] = None,
    source: str | None = None,
    vacancy_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    cv_version_id: uuid.UUID | None = None,
) -> PageOut:
    stmt = _loaded(
        select(Application)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .where(Application.user_id == current_user.id, Application.deleted_at.is_(None))
        .order_by(Application.created_at.desc())
    )
    if search:
        stmt = stmt.outerjoin(Company, Vacancy.company_id == Company.id).where(
            Vacancy.title.ilike(f"%{search}%") | Company.name.ilike(f"%{search}%")
        )
    if application_status is not None:
        stmt = stmt.where(Application.status == application_status)
    if source:
        stmt = stmt.where(Application.source == source)
    if vacancy_id is not None:
        stmt = stmt.where(Application.vacancy_id == vacancy_id)
    if company_id is not None:
        stmt = stmt.where(Vacancy.company_id == company_id)
    if cv_version_id is not None:
        stmt = stmt.where(Application.cv_version_id == cv_version_id)
    items, total = paginate(db, stmt, params.page, params.page_size)
    return PageOut(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    data: ApplicationCreate, current_user: CurrentUser, db: DbSession
) -> Application:
    get_owned_or_404(db, Vacancy, data.vacancy_id, current_user.id)
    if data.cv_version_id is not None:
        get_owned_or_404(db, CVVersion, data.cv_version_id, current_user.id)

    applied_at = data.applied_at
    if applied_at is None and data.status != ApplicationStatus.SAVED:
        applied_at = date.today()

    application = Application(
        user_id=current_user.id,
        vacancy_id=data.vacancy_id,
        cv_version_id=data.cv_version_id,
        status=data.status,
        applied_at=applied_at,
        source=data.source,
        notes=data.notes,
    )
    db.add(application)
    record_status_change(db, application, None, data.status, current_user.id)
    record_event(
        db,
        APPLICATION_CREATED,
        user_id=current_user.id,
        properties={"status": data.status.value},
    )
    db.commit()
    return _get_loaded(db, application.id, current_user.id)


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(
    application_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Application:
    return _get_loaded(db, application_id, current_user.id)


@router.patch("/{application_id}", response_model=ApplicationOut)
def update_application(
    application_id: uuid.UUID, data: ApplicationUpdate, current_user: CurrentUser, db: DbSession
) -> Application:
    application = get_owned_or_404(db, Application, application_id, current_user.id)
    updates = data.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is None:
        raise HTTPException(status_code=422, detail="status cannot be null")
    if updates.get("cv_version_id") is not None:
        get_owned_or_404(db, CVVersion, updates["cv_version_id"], current_user.id)
    old_status = application.status
    for key, value in updates.items():
        setattr(application, key, value)
    if "status" in updates and application.status != old_status:
        record_status_change(db, application, old_status, application.status, current_user.id)
    db.commit()
    return _get_loaded(db, application.id, current_user.id)


@router.get("/{application_id}/status-history", response_model=list[StatusHistoryOut])
def get_status_history(
    application_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[ApplicationStatusHistory]:
    get_owned_or_404(db, Application, application_id, current_user.id)
    return list(
        db.scalars(
            select(ApplicationStatusHistory)
            .where(ApplicationStatusHistory.application_id == application_id)
            .order_by(ApplicationStatusHistory.changed_at.asc(), ApplicationStatusHistory.id)
        ).all()
    )


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    application_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    application = get_owned_or_404(db, Application, application_id, current_user.id)
    application.deleted_at = datetime.now(UTC)
    db.commit()
