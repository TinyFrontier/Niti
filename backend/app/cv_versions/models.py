from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.model_mixins import OwnedMixin, SoftDeleteMixin, TimestampMixin, UUIDPkMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.applications.models import Application


class CVVersion(UUIDPkMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "cv_versions"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    language: Mapped[str | None] = mapped_column(String(16))
    specialization: Mapped[str | None] = mapped_column(String(255))
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # path relative to UPLOAD_DIR — storage backend can be swapped for S3 later
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)

    applications: Mapped[list["Application"]] = relationship(back_populates="cv_version")
