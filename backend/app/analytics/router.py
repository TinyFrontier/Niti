import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import func, select

from app.applications.models import Application
from app.auth.dependencies import CurrentUser, DbSession
from app.common.enums import ACTIVE_APPLICATION_STATUSES, ApplicationStatus, TaskStatus
from app.cv_versions.models import CVVersion
from app.interviews.models import Interview
from app.tasks.models import Task
from app.vacancies.models import Vacancy

router = APIRouter()

# ordinal rank of each status in the pipeline; terminal negatives rank as "applied"
# (without a status-history table we only know the current status — good enough for MVP)
_FUNNEL_RANK: dict[ApplicationStatus, int] = {
    ApplicationStatus.APPLIED: 1,
    ApplicationStatus.IN_REVIEW: 1,
    ApplicationStatus.REJECTED: 1,
    ApplicationStatus.WITHDRAWN: 1,
    ApplicationStatus.GHOSTED: 1,
    ApplicationStatus.ARCHIVED: 1,
    ApplicationStatus.RECRUITER_SCREEN: 2,
    ApplicationStatus.TECHNICAL_INTERVIEW: 3,
    ApplicationStatus.TEST_TASK: 3,
    ApplicationStatus.FINAL_INTERVIEW: 4,
    ApplicationStatus.OFFER: 5,
}

_FUNNEL_STAGES = [
    ("applied", 1),
    ("recruiter_screen", 2),
    ("technical_interview", 3),
    ("final_interview", 4),
    ("offer", 5),
]


def _status_counts(db, user_id: uuid.UUID) -> dict[ApplicationStatus, int]:
    return dict(
        db.execute(
            select(Application.status, func.count())
            .where(Application.user_id == user_id, Application.deleted_at.is_(None))
            .group_by(Application.status)
        ).all()
    )


class SummaryOut(BaseModel):
    total_applications: int
    active_applications: int
    upcoming_interviews: int
    tasks_due: int
    offers: int
    rejected: int
    saved_vacancies: int


@router.get("/summary", response_model=SummaryOut)
def summary(current_user: CurrentUser, db: DbSession) -> SummaryOut:
    status_counts = _status_counts(db, current_user.id)
    total = sum(status_counts.values())
    active = sum(status_counts.get(s, 0) for s in ACTIVE_APPLICATION_STATUSES)

    upcoming_interviews = db.scalar(
        select(func.count())
        .select_from(Interview)
        .where(
            Interview.user_id == current_user.id,
            Interview.deleted_at.is_(None),
            Interview.scheduled_at >= datetime.now(UTC),
        )
    )
    tasks_due = db.scalar(
        select(func.count())
        .select_from(Task)
        .where(
            Task.user_id == current_user.id,
            Task.deleted_at.is_(None),
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
            Task.due_date <= date.today(),
        )
    )
    saved_vacancies = db.scalar(
        select(func.count())
        .select_from(Vacancy)
        .where(
            Vacancy.user_id == current_user.id,
            Vacancy.deleted_at.is_(None),
            Vacancy.archived_at.is_(None),
        )
    )

    return SummaryOut(
        total_applications=total,
        active_applications=active,
        upcoming_interviews=upcoming_interviews or 0,
        tasks_due=tasks_due or 0,
        offers=status_counts.get(ApplicationStatus.OFFER, 0),
        rejected=status_counts.get(ApplicationStatus.REJECTED, 0),
        saved_vacancies=saved_vacancies or 0,
    )


class CountItem(BaseModel):
    label: str
    count: int


@router.get("/applications-by-status", response_model=list[CountItem])
def applications_by_status(current_user: CurrentUser, db: DbSession) -> list[CountItem]:
    counts = _status_counts(db, current_user.id)
    return [
        CountItem(label=s.value, count=counts[s])
        for s in ApplicationStatus
        if counts.get(s, 0) > 0
    ]


@router.get("/applications-by-source", response_model=list[CountItem])
def applications_by_source(current_user: CurrentUser, db: DbSession) -> list[CountItem]:
    rows = db.execute(
        select(func.coalesce(Application.source, "unknown"), func.count())
        .where(Application.user_id == current_user.id, Application.deleted_at.is_(None))
        .group_by(Application.source)
        .order_by(func.count().desc())
    ).all()
    return [CountItem(label=source, count=count) for source, count in rows]


@router.get("/funnel", response_model=list[CountItem])
def funnel(current_user: CurrentUser, db: DbSession) -> list[CountItem]:
    """Applications that reached each stage or further, judged by current status."""
    counts = _status_counts(db, current_user.id)
    result = []
    for label, stage_rank in _FUNNEL_STAGES:
        reached = sum(
            count
            for status_value, count in counts.items()
            if _FUNNEL_RANK.get(status_value, 0) >= stage_rank
        )
        result.append(CountItem(label=label, count=reached))
    return result


class CVUsageItem(BaseModel):
    cv_version_id: uuid.UUID
    title: str
    applications_count: int


@router.get("/cv-usage", response_model=list[CVUsageItem])
def cv_usage(current_user: CurrentUser, db: DbSession) -> list[CVUsageItem]:
    rows = db.execute(
        select(CVVersion.id, CVVersion.title, func.count(Application.id))
        .outerjoin(
            Application,
            (Application.cv_version_id == CVVersion.id) & Application.deleted_at.is_(None),
        )
        .where(CVVersion.user_id == current_user.id, CVVersion.deleted_at.is_(None))
        .group_by(CVVersion.id, CVVersion.title)
        .order_by(func.count(Application.id).desc())
    ).all()
    return [
        CVUsageItem(cv_version_id=cv_id, title=title, applications_count=count)
        for cv_id, title, count in rows
    ]
