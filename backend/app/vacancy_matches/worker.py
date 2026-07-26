"""DB-backed queue for match analyses.

A run takes tens of seconds, which is too long to hold an HTTP request open, so
`POST /vacancies/{id}/match` only writes a `processing` row and the work happens
here. The queue lives in the same table as the results: no broker to deploy, and
a task survives a restart because it is a row, not a message in memory.

Claiming uses `FOR UPDATE SKIP LOCKED`, so running several workers later needs no
change. A worker that dies mid-run leaves its row claimed but unfinished, which
is what `reap_orphans` is for — otherwise the user watches a spinner forever.
"""

import logging
import threading
import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.provider import AIError, AIProvider
from app.career_profiles.models import CareerProfile
from app.career_profiles.schemas import CareerProfileData
from app.common.enums import MatchStatus
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.cv_versions.models import CVVersion
from app.events.names import VACANCY_MATCH_COMPLETED, VACANCY_MATCH_FAILED
from app.events.service import record_event
from app.vacancies.models import Vacancy
from app.vacancy_matches import analysis, scoring
from app.vacancy_matches.models import VacancyMatchAnalysis

logger = logging.getLogger("app.vacancy_matches")

POLL_SECONDS = 2.0
# a run that has not finished by now is presumed dead, not slow
ORPHAN_AFTER = timedelta(minutes=5)

ERROR_INPUTS_GONE = "inputs_unavailable"


def claim_next(db: Session) -> VacancyMatchAnalysis | None:
    """Take the oldest unclaimed task, or return None."""
    task = db.execute(
        select(VacancyMatchAnalysis)
        .where(
            VacancyMatchAnalysis.status == MatchStatus.PROCESSING,
            VacancyMatchAnalysis.started_at.is_(None),
        )
        .order_by(VacancyMatchAnalysis.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    ).scalar_one_or_none()
    if task is not None:
        task.started_at = datetime.now(UTC)
        db.commit()
    return task


def run_task(db: Session, provider: AIProvider, task: VacancyMatchAnalysis) -> None:
    """Execute one claimed task. Never raises: a failure is a status on the row."""
    try:
        vacancy, cv, profile = _load_inputs(db, task)
        evidence = analysis.analyze(
            provider,
            vacancy=vacancy,
            cv_text=cv.extracted_text if cv else None,
            profile=profile,
            # must be the model the input hash was built from, or a cached result
            # would answer for a model that never ran
            model=get_settings().match_model(),
        )
    except AIError as error:
        _fail(db, task, error.code)
        return
    except _InputsGone:
        _fail(db, task, ERROR_INPUTS_GONE)
        return
    except Exception:
        # Never let one bad task take the worker down with it. The message is
        # deliberately absent: it can quote the prompt back.
        logger.exception("match analysis failed unexpectedly", extra={"analysis_id": str(task.id)})
        _fail(db, task, "internal_error")
        return

    outcome = scoring.score_evidence(evidence)
    matches, gaps = scoring.split_findings(evidence.findings)

    task.status = MatchStatus.COMPLETED
    task.score = outcome.score
    task.verdict = outcome.verdict
    task.confidence = outcome.confidence
    task.next_action = outcome.next_action
    task.summary = evidence.summary
    task.score_breakdown = outcome.breakdown.model_dump(mode="json")
    task.matches = [item.model_dump(mode="json") for item in matches]
    task.gaps = [item.model_dump(mode="json") for item in gaps]
    # one column, but a blocker is not a warning: only the first kind caps the
    # score, so the flag travels with the entry for the UI to separate them
    task.red_flags = [
        {**item.model_dump(mode="json"), "blocking": True} for item in evidence.hard_blockers
    ] + [
        {"kind": "note", "detail": flag, "vacancy_quote": "", "blocking": False}
        for flag in evidence.red_flags
    ]
    task.unknowns = list(evidence.unknowns)
    task.model_name = get_settings().match_model()
    task.prompt_version = analysis.PROMPT_VERSION
    task.scoring_version = scoring.SCORING_VERSION
    task.completed_at = datetime.now(UTC)

    record_event(
        db,
        VACANCY_MATCH_COMPLETED,
        user_id=task.user_id,
        properties={
            "verdict": outcome.verdict.value,
            "confidence": outcome.confidence.value,
            "duration_bucket": _duration_bucket(task),
        },
    )
    db.commit()


def reap_orphans(db: Session, older_than: timedelta = ORPHAN_AFTER) -> int:
    """Fail tasks claimed by a worker that never came back."""
    deadline = datetime.now(UTC) - older_than
    orphans = db.execute(
        select(VacancyMatchAnalysis).where(
            VacancyMatchAnalysis.status == MatchStatus.PROCESSING,
            VacancyMatchAnalysis.started_at.is_not(None),
            VacancyMatchAnalysis.started_at < deadline,
        )
    ).scalars()
    count = 0
    for task in orphans:
        _fail(db, task, "worker_lost", commit=False)
        count += 1
    if count:
        db.commit()
    return count


def run_once(db: Session, provider: AIProvider) -> bool:
    """One iteration: returns True when a task was processed."""
    task = claim_next(db)
    if task is None:
        return False
    run_task(db, provider, task)
    return True


def start_background_worker(provider: AIProvider) -> threading.Thread:
    """Poll the queue for the life of the process.

    A daemon thread inside the API process is enough while there is one container
    to deploy; the claim query is what keeps this honest if that ever changes.
    """

    def loop() -> None:
        while True:
            try:
                with SessionLocal() as db:
                    reap_orphans(db)
                    worked = run_once(db, provider)
            except Exception:
                logger.exception("match worker iteration failed")
                worked = False
            if not worked:
                time.sleep(POLL_SECONDS)

    thread = threading.Thread(target=loop, name="niti-match-worker", daemon=True)
    thread.start()
    return thread


class _InputsGone(Exception):
    """A vacancy, CV or profile disappeared between queueing and running."""


def _load_inputs(
    db: Session, task: VacancyMatchAnalysis
) -> tuple[Vacancy, CVVersion | None, CareerProfileData]:
    vacancy = db.get(Vacancy, task.vacancy_id)
    profile_row = db.execute(
        select(CareerProfile).where(CareerProfile.user_id == task.user_id)
    ).scalar_one_or_none()
    if vacancy is None or profile_row is None:
        raise _InputsGone
    cv = db.get(CVVersion, task.cv_version_id) if task.cv_version_id else None
    return vacancy, cv, CareerProfileData.model_validate(profile_row.profile_data)


def _fail(db: Session, task: VacancyMatchAnalysis, code: str, *, commit: bool = True) -> None:
    task.status = MatchStatus.FAILED
    task.error_code = code
    task.completed_at = datetime.now(UTC)
    record_event(db, VACANCY_MATCH_FAILED, user_id=task.user_id, properties={"error_code": code})
    if commit:
        db.commit()


def _duration_bucket(task: VacancyMatchAnalysis) -> str:
    started = task.started_at or task.created_at
    seconds = (datetime.now(UTC) - started).total_seconds()
    if seconds < 10:
        return "under_10s"
    if seconds < 30:
        return "10_30s"
    if seconds < 60:
        return "30_60s"
    return "over_60s"
