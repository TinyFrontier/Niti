import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.enums import EntityType, TaskPriority, TaskStatus
from app.common.model_mixins import (
    OwnedMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPkMixin,
    str_enum,
)
from app.core.database import Base


class Task(UUIDPkMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "tasks"
    __table_args__ = (Index("ix_tasks_entity", "entity_type", "entity_id"),)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(
        str_enum(TaskStatus), default=TaskStatus.TODO, index=True, nullable=False
    )
    priority: Mapped[TaskPriority] = mapped_column(
        str_enum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False
    )
    due_date: Mapped[date | None] = mapped_column(Date, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # optional link to vacancy / application / company / contact / interview
    entity_type: Mapped[EntityType | None] = mapped_column(str_enum(EntityType))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(PgUUID(as_uuid=True))
