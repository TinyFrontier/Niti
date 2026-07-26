from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.enums import CVExtractionStatus
from app.common.model_mixins import (
    OwnedMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPkMixin,
    str_enum,
)
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

    extraction_status: Mapped[CVExtractionStatus] = mapped_column(
        str_enum(CVExtractionStatus),
        default=CVExtractionStatus.PENDING,
        # kept in the DB too, so a deploy that migrates ahead of the code can still insert
        server_default=CVExtractionStatus.PENDING.value,
        nullable=False,
    )
    # deferred: whole CV bodies must not ride along with every list query
    extracted_text: Mapped[str | None] = mapped_column(Text, deferred=True)
    # AI-structured view of the CV (experience, skills, education) — filled later
    structured_content: Mapped[dict | None] = mapped_column(JSONB, deferred=True)
    # short machine-readable code, never parser output or document content
    extraction_error: Mapped[str | None] = mapped_column(String(50))
    content_hash: Mapped[str | None] = mapped_column(String(64))
    extracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    applications: Mapped[list["Application"]] = relationship(back_populates="cv_version")
