import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.auth.dependencies import CurrentUser, DbSession
from app.common.crud import get_owned_or_404, paginate
from app.common.enums import TaskPriority, TaskStatus
from app.common.schemas import PageDep, PageOut
from app.tasks.models import Task
from app.tasks.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter()


@router.get("", response_model=PageOut[TaskOut])
def list_tasks(
    current_user: CurrentUser,
    db: DbSession,
    params: PageDep,
    task_status: Annotated[TaskStatus | None, Query(alias="status")] = None,
    priority: TaskPriority | None = None,
    overdue: bool = False,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
) -> PageOut:
    stmt = (
        select(Task)
        .where(Task.user_id == current_user.id, Task.deleted_at.is_(None))
        .order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())
    )
    if task_status is not None:
        stmt = stmt.where(Task.status == task_status)
    if priority is not None:
        stmt = stmt.where(Task.priority == priority)
    if overdue:
        stmt = stmt.where(
            Task.due_date < date.today(),
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
        )
    if entity_type is not None:
        stmt = stmt.where(Task.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(Task.entity_id == entity_id)
    items, total = paginate(db, stmt, params.page, params.page_size)
    return PageOut(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(data: TaskCreate, current_user: CurrentUser, db: DbSession) -> Task:
    task = Task(user_id=current_user.id, **data.model_dump())
    if task.status == TaskStatus.DONE:
        task.completed_at = datetime.now(UTC)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Task:
    return get_owned_or_404(db, Task, task_id, current_user.id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: uuid.UUID, data: TaskUpdate, current_user: CurrentUser, db: DbSession
) -> Task:
    task = get_owned_or_404(db, Task, task_id, current_user.id)
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(task, key, value)
    if "status" in updates:
        task.completed_at = datetime.now(UTC) if task.status == TaskStatus.DONE else None
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    task = get_owned_or_404(db, Task, task_id, current_user.id)
    task.deleted_at = datetime.now(UTC)
    db.commit()
