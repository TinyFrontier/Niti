from typing import TYPE_CHECKING

from sqlalchemy import Index, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.model_mixins import OwnedMixin, SoftDeleteMixin, TimestampMixin, UUIDPkMixin
from app.core.database import Base

if TYPE_CHECKING:
    from app.contacts.models import Contact
    from app.vacancies.models import Vacancy


class Company(UUIDPkMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "companies"
    __table_args__ = (Index("ix_companies_user_normalized_name", "user_id", "normalized_name"),)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    website: Mapped[str | None] = mapped_column(String(500))
    industry: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))
    size: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)
    # interest level 1..5, set by the user
    rating: Mapped[int | None] = mapped_column(SmallInteger)

    vacancies: Mapped[list["Vacancy"]] = relationship(back_populates="company")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="company")
