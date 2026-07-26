from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.common.enums import UserRole
from app.common.model_mixins import TimestampMixin, UUIDPkMixin, str_enum
from app.core.database import Base


class User(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # null for accounts created via Google sign-in (no local password)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255))
    # null until the user picks a role in onboarding
    role: Mapped[UserRole | None] = mapped_column(str_enum(UserRole))
    # onboarding is more than the role for job seekers, so completion is its own
    # fact: null keeps the user in the wizard, set lets them into the app
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # consent to send documents to the external AI provider (privacy requirement)
    ai_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
