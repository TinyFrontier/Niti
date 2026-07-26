"""What the model is allowed to say, and what the API gives back.

The model returns evidence only — requirements, their status and the fragments
those judgements rest on. Score, verdict and confidence are computed from that
evidence by `scoring`, never generated. A model asked for a number produces a
plausible one; a model asked for evidence can be checked.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.common.enums import (
    EvidenceSource,
    HardBlockerKind,
    MatchConfidence,
    MatchStatus,
    MatchVerdict,
    NextAction,
    RequirementImportance,
    RequirementStatus,
    ScoreCategory,
)

_STRICT = ConfigDict(extra="forbid")


class RequirementFinding(BaseModel):
    model_config = _STRICT

    requirement: str = Field(min_length=1, max_length=300)
    category: ScoreCategory
    importance: RequirementImportance
    status: RequirementStatus
    # short fragment of the vacancy the requirement was read from
    vacancy_quote: str = Field(min_length=1, max_length=500)
    # what in the candidate's materials backs a met/partial status
    evidence: str | None = Field(default=None, max_length=500)
    evidence_source: EvidenceSource | None = None


class HardBlocker(BaseModel):
    model_config = _STRICT

    kind: HardBlockerKind
    detail: str = Field(min_length=1, max_length=300)
    vacancy_quote: str = Field(min_length=1, max_length=500)


class MatchEvidence(BaseModel):
    """The model's entire contribution."""

    model_config = _STRICT

    summary: str = Field(min_length=1, max_length=1000)
    findings: list[RequirementFinding] = Field(default_factory=list, max_length=40)
    hard_blockers: list[HardBlocker] = Field(default_factory=list, max_length=10)
    red_flags: list[str] = Field(default_factory=list, max_length=10)
    unknowns: list[str] = Field(default_factory=list, max_length=15)


class CategoryScore(BaseModel):
    category: ScoreCategory
    score: float
    max_score: float
    # false when the vacancy said nothing this category could be judged on
    assessed: bool


class ScoreBreakdown(BaseModel):
    categories: list[CategoryScore]
    # set when a hard blocker capped the total
    capped_by_blocker: bool


class MatchAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vacancy_id: uuid.UUID
    cv_version_id: uuid.UUID | None
    profile_revision: int
    status: MatchStatus

    score: int | None
    verdict: MatchVerdict | None
    confidence: MatchConfidence | None
    summary: str | None
    next_action: NextAction | None

    score_breakdown: dict | None
    matches: list | None
    gaps: list | None
    red_flags: list | None
    unknowns: list | None

    model_name: str | None
    prompt_version: str | None
    scoring_version: str | None
    error_code: str | None

    created_at: datetime
    completed_at: datetime | None
    # recomputed on read: the vacancy, CV or profile changed since the analysis
    is_stale: bool = False


class MatchSummaryOut(BaseModel):
    """Just enough for a badge in a list."""

    vacancy_id: uuid.UUID
    status: MatchStatus
    score: int | None
    verdict: MatchVerdict | None
    confidence: MatchConfidence | None
    is_stale: bool


class MatchRequest(BaseModel):
    model_config = _STRICT

    cv_version_id: uuid.UUID | None = None
    force: bool = False
