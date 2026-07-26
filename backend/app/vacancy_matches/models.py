import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.common.enums import MatchConfidence, MatchStatus, MatchVerdict, NextAction
from app.common.model_mixins import OwnedMixin, UUIDPkMixin, str_enum
from app.core.database import Base


class VacancyMatchAnalysis(UUIDPkMixin, OwnedMixin, Base):
    """An immutable snapshot of one analysis.

    Nothing here is updated once the run completes: a later edit to the vacancy,
    the CV or the profile produces a new row and leaves this one in the history,
    marked stale on read by comparing `input_hash`.
    """

    __tablename__ = "vacancy_match_analyses"

    # nullable while the analysis belongs to an import preview: the score is
    # computed before the user decides to save, so there is no row to point at
    # yet. Commit fills this in and the result carries over to the vacancy.
    vacancy_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vacancies.id", ondelete="CASCADE"), index=True
    )
    # the previewed fields the analysis ran on, so the worker has something to
    # send even before a vacancy exists. Left in place after the analysis is
    # attached: it records what was actually judged.
    preview_snapshot: Mapped[dict | None] = mapped_column(JSONB)
    # nullable so an analysis survives the CV being soft-deleted afterwards
    cv_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("cv_versions.id", ondelete="SET NULL")
    )
    profile_revision: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[MatchStatus] = mapped_column(str_enum(MatchStatus), nullable=False)
    # hash of vacancy + CV + profile + prompt/scoring versions; identical inputs
    # can reuse a finished result, and a changed one makes this row stale
    input_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    score: Mapped[int | None] = mapped_column(Integer)
    verdict: Mapped[MatchVerdict | None] = mapped_column(str_enum(MatchVerdict))
    confidence: Mapped[MatchConfidence | None] = mapped_column(str_enum(MatchConfidence))
    summary: Mapped[str | None] = mapped_column(Text)
    next_action: Mapped[NextAction | None] = mapped_column(str_enum(NextAction))

    score_breakdown: Mapped[dict | None] = mapped_column(JSONB)
    matches: Mapped[list | None] = mapped_column(JSONB)
    gaps: Mapped[list | None] = mapped_column(JSONB)
    red_flags: Mapped[list | None] = mapped_column(JSONB)
    unknowns: Mapped[list | None] = mapped_column(JSONB)

    model_name: Mapped[str | None] = mapped_column(String(100))
    prompt_version: Mapped[str | None] = mapped_column(String(20))
    scoring_version: Mapped[str | None] = mapped_column(String(20))
    # machine-readable code only — never provider output or document content
    error_code: Mapped[str | None] = mapped_column(String(50))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    # set when a worker claims the row, so a reaper can free tasks orphaned by a
    # process that died mid-run
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        # the queue claim: oldest unclaimed processing row first
        Index(
            "ix_vacancy_match_analyses_queue",
            "status",
            "started_at",
            "created_at",
        ),
        # "latest analysis for this vacancy" on the detail page
        Index("ix_vacancy_match_analyses_vacancy_created", "vacancy_id", "created_at"),
    )
