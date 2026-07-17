from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.common.model_mixins import (
    EntityRefMixin,
    OwnedMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPkMixin,
)
from app.core.database import Base


class Note(UUIDPkMixin, OwnedMixin, EntityRefMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "notes"
    __table_args__ = (Index("ix_notes_entity", "entity_type", "entity_id"),)

    title: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, nullable=False)
