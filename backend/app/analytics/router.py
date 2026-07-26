import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import func, select

from app.applications.models import Application, ApplicationStatusHistory
from app.auth.dependencies import CurrentUser, DbSession
from app.common.enums import ACTIVE_APPLICATION_STATUSES, ApplicationStatus, TaskStatus
from app.cv_versions.models import CVVersion
from app.events.models import Event
from app.events.names import USER_REGISTERED, VACANCY_SAVED
from app.interviews.models import Interview
from app.tasks.models import Task
from app.vacancies.models import Vacancy

router = APIRouter()

# ordinal rank of each status in the pipeline; terminal negatives rank as "applied"
# (the funnel walks application_status_history, so every stage an application ever
# reached counts — not just its current status)
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
    active_applications_added_this_week: int
    interviews_this_week: int
    tasks_due_today: int
    offers_this_week: int
    applications_moved_this_week: int


@router.get("/summary", response_model=SummaryOut)
def summary(current_user: CurrentUser, db: DbSession) -> SummaryOut:
    now = datetime.now(UTC)
    today = now.date()
    week_start = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    week_end = week_start + timedelta(days=7)
    status_counts = _status_counts(db, current_user.id)
    total = sum(status_counts.values())
    active = sum(status_counts.get(s, 0) for s in ACTIVE_APPLICATION_STATUSES)

    upcoming_interviews = db.scalar(
        select(func.count())
        .select_from(Interview)
        .where(
            Interview.user_id == current_user.id,
            Interview.deleted_at.is_(None),
            Interview.scheduled_at >= now,
        )
    )
    tasks_due = db.scalar(
        select(func.count())
        .select_from(Task)
        .where(
            Task.user_id == current_user.id,
            Task.deleted_at.is_(None),
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
            Task.due_date <= today,
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
    active_added_this_week = db.scalar(
        select(func.count())
        .select_from(Application)
        .where(
            Application.user_id == current_user.id,
            Application.deleted_at.is_(None),
            Application.status.in_(ACTIVE_APPLICATION_STATUSES),
            Application.created_at >= week_start,
            Application.created_at < week_end,
        )
    )
    interviews_this_week = db.scalar(
        select(func.count())
        .select_from(Interview)
        .where(
            Interview.user_id == current_user.id,
            Interview.deleted_at.is_(None),
            Interview.scheduled_at >= week_start,
            Interview.scheduled_at < week_end,
        )
    )
    tasks_due_today = db.scalar(
        select(func.count())
        .select_from(Task)
        .where(
            Task.user_id == current_user.id,
            Task.deleted_at.is_(None),
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
            Task.due_date == today,
        )
    )
    offers_this_week = db.scalar(
        select(func.count(func.distinct(ApplicationStatusHistory.application_id)))
        .select_from(ApplicationStatusHistory)
        .join(Application, Application.id == ApplicationStatusHistory.application_id)
        .where(
            ApplicationStatusHistory.user_id == current_user.id,
            Application.deleted_at.is_(None),
            ApplicationStatusHistory.to_status == ApplicationStatus.OFFER,
            ApplicationStatusHistory.changed_at >= week_start,
            ApplicationStatusHistory.changed_at < week_end,
        )
    )
    applications_moved_this_week = db.scalar(
        select(func.count(func.distinct(ApplicationStatusHistory.application_id)))
        .select_from(ApplicationStatusHistory)
        .join(Application, Application.id == ApplicationStatusHistory.application_id)
        .where(
            ApplicationStatusHistory.user_id == current_user.id,
            Application.deleted_at.is_(None),
            ApplicationStatusHistory.from_status.is_not(None),
            ApplicationStatusHistory.changed_at >= week_start,
            ApplicationStatusHistory.changed_at < week_end,
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
        active_applications_added_this_week=active_added_this_week or 0,
        interviews_this_week=interviews_this_week or 0,
        tasks_due_today=tasks_due_today or 0,
        offers_this_week=offers_this_week or 0,
        applications_moved_this_week=applications_moved_this_week or 0,
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
    """Applications that reached each stage or further, judged by full status history."""
    rows = db.execute(
        select(ApplicationStatusHistory.application_id, ApplicationStatusHistory.to_status)
        .join(Application, Application.id == ApplicationStatusHistory.application_id)
        .where(
            ApplicationStatusHistory.user_id == current_user.id,
            Application.deleted_at.is_(None),
        )
        .distinct()
    ).all()
    max_rank: dict[uuid.UUID, int] = {}
    for application_id, to_status in rows:
        rank = _FUNNEL_RANK.get(to_status, 0)
        if rank > max_rank.get(application_id, 0):
            max_rank[application_id] = rank
    return [
        CountItem(
            label=label,
            count=sum(1 for rank in max_rank.values() if rank >= stage_rank),
        )
        for label, stage_rank in _FUNNEL_STAGES
    ]


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


class ActivationOut(BaseModel):
    registered: int
    activated: int
    rate: float


_ACTIVATION_WINDOW = timedelta(minutes=10)


@router.get("/activation", response_model=ActivationOut)
def activation(current_user: CurrentUser, db: DbSession, window_days: int = 30) -> ActivationOut:
    """Share of recently registered users who saved a vacancy within 10 minutes."""
    since = datetime.now(UTC) - timedelta(days=window_days)

    registrations = (
        select(Event.user_id, func.min(Event.occurred_at).label("registered_at"))
        .where(
            Event.name == USER_REGISTERED,
            Event.occurred_at >= since,
            Event.user_id.is_not(None),
        )
        .group_by(Event.user_id)
        .subquery("registrations")
    )
    first_saves = (
        select(Event.user_id, func.min(Event.occurred_at).label("first_saved_at"))
        .where(Event.name == VACANCY_SAVED, Event.user_id.is_not(None))
        .group_by(Event.user_id)
        .subquery("first_saves")
    )

    registered = db.scalar(select(func.count()).select_from(registrations)) or 0
    activated = (
        db.scalar(
            select(func.count())
            .select_from(registrations)
            .join(first_saves, first_saves.c.user_id == registrations.c.user_id)
            .where(
                first_saves.c.first_saved_at
                <= registrations.c.registered_at + _ACTIVATION_WINDOW
            )
        )
        or 0
    )

    rate = activated / registered if registered else 0.0
    return ActivationOut(registered=registered, activated=activated, rate=rate)
