import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.common.model_mixins import TimestampMixin, UUIDPkMixin
from app.core.database import Base


class CareerProfile(UUIDPkMixin, TimestampMixin, Base):
    """One profile per user; the payload is validated by CareerProfileData.

    `revision` tracks confirmed content only. Wizard steps save through PATCH and
    leave it alone, so a half-filled draft never makes an existing job match look
    stale — only a real change to confirmed data does.
    """

    __tablename__ = "career_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    profile_data: Mapped[dict] = mapped_column(JSONB, server_default="{}", nullable=False)
    revision: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
