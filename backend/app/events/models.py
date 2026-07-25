import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.common.model_mixins import UUIDPkMixin
from app.core.database import Base


class Event(UUIDPkMixin, Base):
    """Append-only analytics event (server- and client-emitted)."""

    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_name_occurred", "name", "occurred_at"),
        Index("ix_events_user_occurred", "user_id", "occurred_at"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    properties: Mapped[dict] = mapped_column(JSONB, server_default="{}", nullable=False)
