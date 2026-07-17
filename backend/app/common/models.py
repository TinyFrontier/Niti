import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.model_mixins import (
    EntityRefMixin,
    OwnedMixin,
    TimestampMixin,
    UUIDPkMixin,
)
from app.core.database import Base


class Tag(UUIDPkMixin, OwnedMixin, TimestampMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tags_user_name"),)

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20))

    entity_tags: Mapped[list["EntityTag"]] = relationship(
        back_populates="tag", cascade="all, delete-orphan"
    )


class EntityTag(UUIDPkMixin, EntityRefMixin, TimestampMixin, Base):
    __tablename__ = "entity_tags"
    __table_args__ = (
        UniqueConstraint("tag_id", "entity_type", "entity_id", name="uq_entity_tags"),
        Index("ix_entity_tags_entity", "entity_type", "entity_id"),
    )

    tag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"), index=True, nullable=False
    )

    tag: Mapped["Tag"] = relationship(back_populates="entity_tags")


class Attachment(UUIDPkMixin, OwnedMixin, EntityRefMixin, TimestampMixin, Base):
    __tablename__ = "attachments"
    __table_args__ = (Index("ix_attachments_entity", "entity_type", "entity_id"),)

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer)
    mime_type: Mapped[str | None] = mapped_column(String(100))
