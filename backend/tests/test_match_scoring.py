"""Deterministic scoring. No provider is involved: these are the rules that turn
a model's evidence into a verdict, and they have to hold on their own."""

import pytest

from app.common.enums import (
    HardBlockerKind,
    MatchConfidence,
    MatchVerdict,
    NextAction,
    RequirementImportance,
    RequirementStatus,
    ScoreCategory,
)
from app.vacancy_matches import scoring
from app.vacancy_matches.schemas import HardBlocker, MatchEvidence, RequirementFinding


def finding(
    category: ScoreCategory = ScoreCategory.SKILLS,
    status: RequirementStatus = RequirementStatus.MET,
    importance: RequirementImportance = RequirementImportance.REQUIRED,
) -> RequirementFinding:
    return RequirementFinding(
        requirement="Python",
        category=category,
        importance=importance,
        status=status,
        vacancy_quote="Strong Python experience",
        evidence="7 years of Python" if status is RequirementStatus.MET else None,
        evidence_source="cv" if status is RequirementStatus.MET else None,
    )


def evidence(findings: list[RequirementFinding], **kwargs) -> MatchEvidence:
    return MatchEvidence(summary="Looks like a fit", findings=findings, **kwargs)


def blocker() -> HardBlocker:
    return HardBlocker(
        kind=HardBlockerKind.LANGUAGE,
        detail="German at C1 is required and the candidate does not speak it",
        vacancy_quote="Fluent German (C1) required",
    )


def category_scores(outcome) -> dict[str, float]:
    return {item.category.value: item.score for item in outcome.breakdown.categories}


# --- the basic mapping ----------------------------------------------------


def test_everything_met_is_a_perfect_score():
    outcome = scoring.score_evidence(
        evidence([finding(category) for category in ScoreCategory])
    )

    assert outcome.score == 100
    assert outcome.verdict is MatchVerdict.APPLY
    assert outcome.next_action is NextAction.CREATE_APPLICATION


def test_everything_missing_scores_zero():
    outcome = scoring.score_evidence(
        evidence([finding(category, RequirementStatus.MISSING) for category in ScoreCategory])
    )

    assert outcome.score == 0
    assert outcome.verdict is MatchVerdict.SKIP
    assert outcome.next_action is NextAction.ARCHIVE_VACANCY


def test_partial_is_worth_half():
    outcome = scoring.score_evidence(
        evidence([finding(category, RequirementStatus.PARTIAL) for category in ScoreCategory])
    )

    assert outcome.score == 50
    assert outcome.verdict is MatchVerdict.MAYBE
    assert outcome.next_action is NextAction.REVIEW_GAPS


def test_unknown_never_counts_as_a_match():
    unknown = scoring.score_evidence(
        evidence([finding(category, RequirementStatus.UNKNOWN) for category in ScoreCategory])
    )
    missing = scoring.score_evidence(
        evidence([finding(category, RequirementStatus.MISSING) for category in ScoreCategory])
    )

    assert unknown.score == missing.score == 0


@pytest.mark.parametrize(
    ("score_at", "verdict"),
    [(100, MatchVerdict.APPLY), (75, MatchVerdict.APPLY), (74, MatchVerdict.MAYBE),
     (50, MatchVerdict.MAYBE), (49, MatchVerdict.SKIP), (0, MatchVerdict.SKIP)],
)
def test_verdict_boundaries(score_at, verdict):
    assert scoring._verdict(score_at) is verdict


# --- weighting ------------------------------------------------------------


def test_a_required_miss_costs_three_times_a_preferred_one():
    required_missed = scoring.score_evidence(
        evidence(
            [
                finding(status=RequirementStatus.MISSING),
                finding(importance=RequirementImportance.PREFERRED),
            ]
        )
    )
    preferred_missed = scoring.score_evidence(
        evidence(
            [
                finding(),
                finding(
                    status=RequirementStatus.MISSING,
                    importance=RequirementImportance.PREFERRED,
                ),
            ]
        )
    )

    assert required_missed.score == 25
    assert preferred_missed.score == 75


# --- categories the vacancy is silent about -------------------------------


def test_silent_categories_do_not_cap_the_score():
    """A vacancy that never mentions pay must not cost the candidate 10 points."""
    outcome = scoring.score_evidence(evidence([finding(ScoreCategory.SKILLS)]))

    assert outcome.score == 100
    assert category_scores(outcome)["skills"] == 100
    assert category_scores(outcome)["compensation"] == 0


def test_unassessed_categories_are_marked_as_such():
    outcome = scoring.score_evidence(evidence([finding(ScoreCategory.SKILLS)]))

    assessed = {item.category.value: item.assessed for item in outcome.breakdown.categories}
    assert assessed == {
        "skills": True,
        "experience": False,
        "location": False,
        "compensation": False,
        "domain": False,
    }


def test_points_are_redistributed_proportionally():
    """Skills and experience alone still add up to 100, keeping their 2:1 ratio."""
    outcome = scoring.score_evidence(
        evidence(
            [
                finding(ScoreCategory.SKILLS),
                finding(ScoreCategory.EXPERIENCE, RequirementStatus.MISSING),
            ]
        )
    )

    scores = category_scores(outcome)
    assert scores["skills"] == pytest.approx(66.7, abs=0.1)
    assert outcome.score == 67


def test_no_findings_at_all_scores_zero_without_dividing_by_zero():
    outcome = scoring.score_evidence(evidence([]))

    assert outcome.score == 0
    assert outcome.confidence is MatchConfidence.LOW


# --- hard blockers --------------------------------------------------------


def test_a_hard_blocker_caps_an_otherwise_perfect_match():
    outcome = scoring.score_evidence(
        evidence([finding(category) for category in ScoreCategory], hard_blockers=[blocker()])
    )

    assert outcome.score == scoring.MAX_SCORE_WITH_BLOCKER
    assert outcome.verdict is MatchVerdict.SKIP
    assert outcome.breakdown.capped_by_blocker is True


def test_a_blocker_does_not_raise_a_low_score():
    outcome = scoring.score_evidence(
        evidence(
            [finding(category, RequirementStatus.MISSING) for category in ScoreCategory],
            hard_blockers=[blocker()],
        )
    )

    assert outcome.score == 0


def test_without_a_blocker_the_breakdown_says_so():
    outcome = scoring.score_evidence(evidence([finding()]))

    assert outcome.breakdown.capped_by_blocker is False


# --- confidence -----------------------------------------------------------


def test_full_evidence_is_high_confidence():
    outcome = scoring.score_evidence(evidence([finding() for _ in range(6)]))

    assert outcome.confidence is MatchConfidence.HIGH


def test_too_few_findings_is_low_confidence_however_good_the_score():
    outcome = scoring.score_evidence(evidence([finding(), finding()]))

    assert outcome.score == 100
    assert outcome.verdict is MatchVerdict.APPLY
    # a verdict on two requirements is a guess, and the UI has to say so
    assert outcome.confidence is MatchConfidence.LOW


def test_many_unresolved_requirements_lower_confidence():
    findings = [finding() for _ in range(4)] + [
        finding(status=RequirementStatus.UNKNOWN) for _ in range(3)
    ]

    assert scoring.score_evidence(evidence(findings)).confidence is MatchConfidence.LOW


def test_gaps_in_the_vacancy_text_lower_confidence_too():
    outcome = scoring.score_evidence(
        evidence([finding() for _ in range(6)], unknowns=["Salary is not stated"])
    )

    assert outcome.confidence is MatchConfidence.MEDIUM


# --- splitting for the UI -------------------------------------------------


def test_matches_and_gaps_are_split_by_status():
    met = finding()
    partial = finding(status=RequirementStatus.PARTIAL)
    missing = finding(status=RequirementStatus.MISSING)
    unknown = finding(status=RequirementStatus.UNKNOWN)

    matches, gaps = scoring.split_findings([met, partial, missing, unknown])

    assert matches == [met, partial]
    assert gaps == [missing]
