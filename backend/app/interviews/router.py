import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.applications.models import Application
from app.auth.dependencies import CurrentUser, DbSession
from app.common.crud import get_owned_or_404, paginate
from app.common.schemas import PageDep, PageOut
from app.interviews.models import Interview
from app.interviews.schemas import InterviewCreate, InterviewOut, InterviewUpdate
from app.vacancies.models import Vacancy

router = APIRouter()


def _loaded(stmt):
    return stmt.options(
        selectinload(Interview.application).selectinload(Application.vacancy).selectinload(
            Vacancy.company
        ),
        selectinload(Interview.application).selectinload(Application.vacancy).selectinload(
            Vacancy.sources
        ),
        selectinload(Interview.application).selectinload(Application.cv_version),
    )


def _get_loaded(db, interview_id: uuid.UUID, user_id: uuid.UUID) -> Interview:
    interview = db.scalar(
        _loaded(
            select(Interview).where(
                Interview.id == interview_id,
                Interview.user_id == user_id,
                Interview.deleted_at.is_(None),
            )
        )
    )
    if interview is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Interview not found")
    return interview


@router.get("", response_model=PageOut[InterviewOut])
def list_interviews(
    current_user: CurrentUser,
    db: DbSession,
    params: PageDep,
    upcoming: bool | None = None,
    application_id: uuid.UUID | None = None,
) -> PageOut:
    stmt = _loaded(
        select(Interview).where(
            Interview.user_id == current_user.id, Interview.deleted_at.is_(None)
        )
    )
    now = datetime.now(UTC)
    if upcoming is True:
        stmt = stmt.where(Interview.scheduled_at >= now).order_by(Interview.scheduled_at.asc())
    elif upcoming is False:
        stmt = stmt.where(Interview.scheduled_at < now).order_by(Interview.scheduled_at.desc())
    else:
        stmt = stmt.order_by(Interview.scheduled_at.desc())
    if application_id is not None:
        stmt = stmt.where(Interview.application_id == application_id)
    items, total = paginate(db, stmt, params.page, params.page_size)
    return PageOut(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("", response_model=InterviewOut, status_code=status.HTTP_201_CREATED)
def create_interview(data: InterviewCreate, current_user: CurrentUser, db: DbSession) -> Interview:
    get_owned_or_404(db, Application, data.application_id, current_user.id)
    interview = Interview(user_id=current_user.id, **data.model_dump())
    db.add(interview)
    db.commit()
    return _get_loaded(db, interview.id, current_user.id)


@router.get("/{interview_id}", response_model=InterviewOut)
def get_interview(interview_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Interview:
    return _get_loaded(db, interview_id, current_user.id)


@router.patch("/{interview_id}", response_model=InterviewOut)
def update_interview(
    interview_id: uuid.UUID, data: InterviewUpdate, current_user: CurrentUser, db: DbSession
) -> Interview:
    interview = get_owned_or_404(db, Interview, interview_id, current_user.id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(interview, key, value)
    db.commit()
    return _get_loaded(db, interview.id, current_user.id)


@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview(interview_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    interview = get_owned_or_404(db, Interview, interview_id, current_user.id)
    interview.deleted_at = datetime.now(UTC)
    db.commit()
