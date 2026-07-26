"""Turn evidence into a score, a verdict and a confidence.

Deliberately deterministic and free of the model: given the same findings this
produces the same number every time, and any result can be explained by pointing
at the rules below rather than at a prompt. `SCORING_VERSION` is stored with each
analysis so an old result stays interpretable after these rules change.
"""

from app.common.enums import (
    HardBlockerKind,
    MatchConfidence,
    MatchVerdict,
    NextAction,
    RequirementImportance,
    RequirementStatus,
    ScoreCategory,
)
from app.vacancy_matches.schemas import (
    CategoryScore,
    MatchEvidence,
    RequirementFinding,
    ScoreBreakdown,
)

SCORING_VERSION = "1.0"

CATEGORY_MAX: dict[ScoreCategory, float] = {
    ScoreCategory.SKILLS: 40,
    ScoreCategory.EXPERIENCE: 20,
    ScoreCategory.LOCATION: 20,
    ScoreCategory.COMPENSATION: 10,
    ScoreCategory.DOMAIN: 10,
}

IMPORTANCE_WEIGHT: dict[RequirementImportance, int] = {
    RequirementImportance.REQUIRED: 3,
    RequirementImportance.PREFERRED: 1,
}

STATUS_CREDIT: dict[RequirementStatus, float] = {
    RequirementStatus.MET: 1.0,
    RequirementStatus.PARTIAL: 0.5,
    RequirementStatus.MISSING: 0.0,
    # never counts as a match; it costs confidence instead
    RequirementStatus.UNKNOWN: 0.0,
}

# A hard blocker means the candidate cannot take the job as advertised, so the
# result must not read as a recommendation however well the rest lines up.
MAX_SCORE_WITH_BLOCKER = 49

APPLY_FROM = 75
MAYBE_FROM = 50

# Confidence thresholds on the share of findings the model could not resolve.
_UNKNOWN_RATIO_LOW = 0.34
_UNKNOWN_RATIO_MEDIUM = 0.15
# below this many findings there is not enough substance to trust a verdict
_MIN_FINDINGS_FOR_CONFIDENCE = 3


class MatchOutcome:
    """Computed result: everything the model was not allowed to decide."""

    def __init__(
        self,
        score: int,
        verdict: MatchVerdict,
        confidence: MatchConfidence,
        breakdown: ScoreBreakdown,
        next_action: NextAction,
    ) -> None:
        self.score = score
        self.verdict = verdict
        self.confidence = confidence
        self.breakdown = breakdown
        self.next_action = next_action


def score_evidence(evidence: MatchEvidence) -> MatchOutcome:
    breakdown = _breakdown(evidence.findings, bool(evidence.hard_blockers))
    raw = sum(category.score for category in breakdown.categories)
    score = round(raw)
    if evidence.hard_blockers:
        score = min(score, MAX_SCORE_WITH_BLOCKER)

    verdict = _verdict(score)
    return MatchOutcome(
        score=score,
        verdict=verdict,
        confidence=_confidence(evidence),
        breakdown=breakdown,
        next_action=_next_action(verdict),
    )


def _breakdown(findings: list[RequirementFinding], blocked: bool) -> ScoreBreakdown:
    """Score each category, then spread the unused maxima over the assessed ones.

    A vacancy that never mentions pay or location should not be capped at 70 for
    staying silent: the score answers "how well does this candidate fit what this
    vacancy actually asks", so categories with no findings drop out and their
    points are redistributed proportionally among those that were assessed.
    """
    earned: dict[ScoreCategory, float] = {}
    possible: dict[ScoreCategory, float] = {}
    for finding in findings:
        weight = IMPORTANCE_WEIGHT[finding.importance]
        earned[finding.category] = (
            earned.get(finding.category, 0.0) + weight * STATUS_CREDIT[finding.status]
        )
        possible[finding.category] = possible.get(finding.category, 0.0) + weight

    assessed = [category for category in CATEGORY_MAX if possible.get(category)]
    assessed_max = sum(CATEGORY_MAX[category] for category in assessed)
    # scale so the assessed categories still add up to 100
    scale = (sum(CATEGORY_MAX.values()) / assessed_max) if assessed_max else 0.0

    categories = []
    for category, base_max in CATEGORY_MAX.items():
        if category in assessed:
            max_score = base_max * scale
            score = max_score * (earned[category] / possible[category])
        else:
            max_score = 0.0
            score = 0.0
        categories.append(
            CategoryScore(
                category=category,
                score=round(score, 1),
                max_score=round(max_score, 1),
                assessed=category in assessed,
            )
        )
    return ScoreBreakdown(categories=categories, capped_by_blocker=blocked)


def _verdict(score: int) -> MatchVerdict:
    if score >= APPLY_FROM:
        return MatchVerdict.APPLY
    if score >= MAYBE_FROM:
        return MatchVerdict.MAYBE
    return MatchVerdict.SKIP


def _confidence(evidence: MatchEvidence) -> MatchConfidence:
    findings = evidence.findings
    if len(findings) < _MIN_FINDINGS_FOR_CONFIDENCE:
        return MatchConfidence.LOW

    unresolved = sum(1 for f in findings if f.status is RequirementStatus.UNKNOWN)
    # data the model flagged as missing from the vacancy counts against it too
    ratio = (unresolved + len(evidence.unknowns)) / len(findings)
    if ratio > _UNKNOWN_RATIO_LOW:
        return MatchConfidence.LOW
    if ratio > _UNKNOWN_RATIO_MEDIUM:
        return MatchConfidence.MEDIUM
    return MatchConfidence.HIGH


def _next_action(verdict: MatchVerdict) -> NextAction:
    return {
        MatchVerdict.APPLY: NextAction.CREATE_APPLICATION,
        MatchVerdict.MAYBE: NextAction.REVIEW_GAPS,
        MatchVerdict.SKIP: NextAction.ARCHIVE_VACANCY,
    }[verdict]


def split_findings(
    findings: list[RequirementFinding],
) -> tuple[list[RequirementFinding], list[RequirementFinding]]:
    """Matches and gaps, as the UI shows them."""
    counted = (RequirementStatus.MET, RequirementStatus.PARTIAL)
    matches = [f for f in findings if f.status in counted]
    gaps = [f for f in findings if f.status is RequirementStatus.MISSING]
    return matches, gaps


def blocker_labels(kinds: list[HardBlockerKind]) -> list[str]:
    return [kind.value for kind in kinds]
