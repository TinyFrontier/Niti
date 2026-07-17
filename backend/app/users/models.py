from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.common.enums import UserRole
from app.common.model_mixins import TimestampMixin, UUIDPkMixin, str_enum
from app.core.database import Base


class User(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    # null until the user picks a role in onboarding
    role: Mapped[UserRole | None] = mapped_column(str_enum(UserRole))
