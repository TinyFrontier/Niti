"""Match API and the queue behind it. The provider is always the mock."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, update

from app.ai.mock import MockAIProvider
from app.ai.provider import TIMEOUT, AIError
from app.common.enums import CVExtractionStatus
from app.core.database import get_db
from app.cv_versions.models import CVVersion
from app.vacancy_matches import worker
from app.vacancy_matches.models import VacancyMatchAnalysis

DESCRIPTION = (
    "We are looking for a senior backend engineer to own our billing platform. "
    "You will design and run Python services on PostgreSQL and Kubernetes, and "
    "work with a distributed team across European timezones. Required: five years "
    "of backend engineering, strong Python, and fluent English. Nice to have: "
    "experience with payment providers and infrastructure as code. The role is "
    "fully remote within the EU and the range is 5000-7000 EUR per month."
)

PROFILE = {
    "target_roles": ["Backend Engineer"],
    "seniority": "senior",
    "core_skills": [{"name": "Python"}, {"name": "PostgreSQL"}, {"name": "Kubernetes"}],
    "current_location": "Lisbon",
    "work_formats": ["remote"],
    "languages": [{"language": "English", "level": "c1"}],
}

EVIDENCE = {
    "summary": "Strong overlap on the core stack.",
    "findings": [
        {
            "requirement": "Strong Python",
            "category": "skills",
            "importance": "required",
            "status": "met",
            "vacancy_quote": "strong Python",
            "evidence": "Python listed as a core skill",
            "evidence_source": "profile",
        },
        {
            "requirement": "Five years of backend engineering",
            "category": "experience",
            "importance": "required",
            "status": "met",
            "vacancy_quote": "five years of backend engineering",
            "evidence": "Senior backend engineer",
            "evidence_source": "cv",
        },
        {
            "requirement": "Remote within the EU",
            "category": "location",
            "importance": "required",
            "status": "met",
            "vacancy_quote": "fully remote within the EU",
            "evidence": "Remote, based in Lisbon",
            "evidence_source": "profile",
        },
    ],
    "hard_blockers": [],
    "red_flags": [],
    "unknowns": [],
}


@pytest.fixture()
def session(client):
    """A session for driving the worker directly.

    The test database is not rolled back between tests, so the queue is emptied
    here: otherwise a task left behind by an earlier test is the one the worker
    claims, and every assertion about "the analysis" watches the wrong row.
    """
    db = next(client.app.dependency_overrides[get_db]())
    db.execute(delete(VacancyMatchAnalysis))
    db.commit()
    return db


@pytest.fixture()
def ready(client, auth_headers, session):
    """A user who can actually run an analysis: consent, profile, CV, vacancy."""
    client.patch("/auth/me", headers=auth_headers, json={"ai_consent": True})
    client.patch("/career-profile", headers=auth_headers, json={"data": PROFILE})
    client.post("/career-profile/confirm", headers=auth_headers)

    upload = client.post(
        "/cv-versions/upload",
        headers=auth_headers,
        files={"file": ("cv.doc", b"legacy", "application/msword")},
        data={"title": "CV"},
    )
    cv_id = upload.json()["id"]
    session.execute(
        update(CVVersion)
        .where(CVVersion.id == uuid.UUID(cv_id))
        .values(
            extraction_status=CVExtractionStatus.COMPLETED,
            extracted_text="Senior backend engineer, Python, PostgreSQL, Kubernetes.",
            content_hash="cv-hash",
        )
    )
    session.commit()

    vacancy = client.post(
        "/vacancies",
        headers=auth_headers,
        json={"title": "Senior Backend Engineer", "description": DESCRIPTION},
    )
    assert vacancy.status_code == 201, vacancy.text
    return {"cv_id": cv_id, "vacancy_id": vacancy.json()["id"]}


def _drain(session, provider) -> bool:
    return worker.run_once(session, provider)


# --- prerequisites --------------------------------------------------------


def test_analysis_needs_a_confirmed_profile(client, auth_headers):
    client.patch("/auth/me", headers=auth_headers, json={"ai_consent": True})
    vacancy = client.post(
        "/vacancies", headers=auth_headers, json={"title": "Dev", "description": DESCRIPTION}
    ).json()

    response = client.post(f"/vacancies/{vacancy['id']}/match", headers=auth_headers, json={})

    assert response.status_code == 400, response.text
    assert "career profile" in response.json()["detail"]


def test_analysis_names_the_missing_profile_fields(client, auth_headers):
    client.patch("/auth/me", headers=auth_headers, json={"ai_consent": True})
    client.patch("/career-profile", headers=auth_headers, json={"data": {"seniority": "senior"}})
    client.post("/career-profile/confirm", headers=auth_headers)
    vacancy = client.post(
        "/vacancies", headers=auth_headers, json={"title": "Dev", "description": DESCRIPTION}
    ).json()

    response = client.post(f"/vacancies/{vacancy['id']}/match", headers=auth_headers, json={})

    assert response.status_code == 400, response.text
    assert "Target roles" in response.json()["detail"]


def test_a_vacancy_without_a_description_cannot_be_analysed(client, auth_headers, ready):
    thin = client.post(
        "/vacancies", headers=auth_headers, json={"title": "Dev", "description": "Backend dev."}
    ).json()

    response = client.post(f"/vacancies/{thin['id']}/match", headers=auth_headers, json={})

    assert response.status_code == 400, response.text
    assert "description" in response.json()["detail"]


def test_analysis_needs_consent(client, auth_headers, session, ready):
    from app.users.models import User

    session.execute(update(User).values(ai_consent_at=None))
    session.commit()

    response = client.post(
        f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={}
    )

    assert response.status_code == 403, response.text


def test_an_unreadable_cv_is_refused(client, auth_headers, ready):
    unreadable = client.post(
        "/cv-versions/upload",
        headers=auth_headers,
        files={"file": ("old.doc", b"legacy", "application/msword")},
        data={"title": "Old"},
    ).json()

    response = client.post(
        f"/vacancies/{ready['vacancy_id']}/match",
        headers=auth_headers,
        json={"cv_version_id": unreadable["id"]},
    )

    assert response.status_code == 400, response.text
    assert "unsupported" in response.json()["detail"]


# --- queueing -------------------------------------------------------------


def test_request_queues_and_returns_202(client, auth_headers, ready):
    response = client.post(
        f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={}
    )

    assert response.status_code == 202, response.text
    body = response.json()
    assert body["status"] == "processing"
    assert body["score"] is None
    # the newest readable CV is picked when the client does not choose
    assert body["cv_version_id"] == ready["cv_id"]


def test_identical_inputs_reuse_the_finished_result(client, auth_headers, session, ready):
    provider = MockAIProvider(EVIDENCE)
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    assert _drain(session, provider)

    again = client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})

    assert again.status_code == 200, again.text
    assert again.json()["status"] == "completed"
    # the model was not asked twice
    assert len(provider.requests) == 1


def test_force_runs_a_second_analysis(client, auth_headers, session, ready):
    provider = MockAIProvider(EVIDENCE, EVIDENCE)
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, provider)

    forced = client.post(
        f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={"force": True}
    )
    _drain(session, provider)

    assert forced.status_code == 202, forced.text
    history = client.get(f"/vacancies/{ready['vacancy_id']}/matches", headers=auth_headers)
    assert len(history.json()) == 2
    assert len(provider.requests) == 2


# --- running --------------------------------------------------------------


def test_a_completed_analysis_carries_score_verdict_and_evidence(
    client, auth_headers, session, ready
):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    assert _drain(session, MockAIProvider(EVIDENCE))

    body = client.get(
        f"/vacancies/{ready['vacancy_id']}/matches/latest", headers=auth_headers
    ).json()

    assert body["status"] == "completed"
    assert body["score"] == 100
    assert body["verdict"] == "apply"
    assert body["next_action"] == "create_application"
    assert body["summary"] == EVIDENCE["summary"]
    assert len(body["matches"]) == 3
    assert body["gaps"] == []
    assert body["scoring_version"] and body["prompt_version"] and body["model_name"]


def test_the_prompt_carries_the_vacancy_and_the_candidate_as_documents(
    client, auth_headers, session, ready
):
    provider = MockAIProvider(EVIDENCE)
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, provider)

    sent = provider.requests[0].user
    assert '<document label="vacancy">' in sent
    assert '<document label="candidate-profile">' in sent
    assert '<document label="candidate-cv">' in sent
    assert "billing platform" in sent


def test_a_provider_failure_becomes_a_failed_analysis(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})

    assert _drain(session, MockAIProvider(AIError(TIMEOUT, "timed out")))

    body = client.get(
        f"/vacancies/{ready['vacancy_id']}/matches/latest", headers=auth_headers
    ).json()
    assert body["status"] == "failed"
    assert body["error_code"] == TIMEOUT
    assert body["score"] is None


def test_a_failed_analysis_is_not_reused(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, MockAIProvider(AIError(TIMEOUT, "timed out")))

    retry = client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})

    assert retry.status_code == 202, retry.text
    assert retry.json()["status"] == "processing"


def test_an_empty_queue_is_not_an_error(client, session):
    assert worker.run_once(session, MockAIProvider()) is False


def test_a_claimed_task_is_not_handed_out_twice(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})

    first = worker.claim_next(session)
    second = worker.claim_next(session)

    assert first is not None
    assert second is None


def test_orphaned_tasks_are_reaped(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    task = worker.claim_next(session)
    session.execute(
        update(VacancyMatchAnalysis)
        .where(VacancyMatchAnalysis.id == task.id)
        .values(started_at=datetime.now(UTC) - timedelta(hours=1))
    )
    session.commit()

    assert worker.reap_orphans(session) == 1

    body = client.get(
        f"/vacancies/{ready['vacancy_id']}/matches/latest", headers=auth_headers
    ).json()
    assert body["status"] == "failed"
    assert body["error_code"] == "worker_lost"


def test_a_running_task_is_left_alone_by_the_reaper(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    worker.claim_next(session)

    assert worker.reap_orphans(session) == 0


# --- automatic analysis on import -----------------------------------------


def _import(client, headers, *, url: str, description: str = DESCRIPTION):
    return client.post(
        "/vacancies/import/commit",
        headers=headers,
        json={
            "url": url,
            "platform": "linkedin",
            "mode": "save",
            "fields": {"title": "Senior Backend Engineer", "description": description},
        },
    )


def test_importing_a_vacancy_queues_its_analysis(client, auth_headers, session, ready):
    response = _import(client, auth_headers, url="https://example.com/jobs/1")

    assert response.status_code == 201, response.text
    vacancy_id = response.json()["vacancy_id"]
    latest = client.get(f"/vacancies/{vacancy_id}/matches/latest", headers=auth_headers)
    assert latest.status_code == 200, latest.text
    assert latest.json()["status"] == "processing"


def test_the_automatic_analysis_is_marked_as_such(client, auth_headers, session, ready):
    _import(client, auth_headers, url="https://example.com/jobs/2")
    provider = MockAIProvider(EVIDENCE)

    assert _drain(session, provider)

    from app.events.models import Event

    user_id = uuid.UUID(client.get("/auth/me", headers=auth_headers).json()["id"])
    triggers = [
        event.properties["trigger"]
        for event in session.query(Event)
        .filter(Event.name == "vacancy_match_started", Event.user_id == user_id)
        .all()
    ]
    assert triggers == ["import"]


def test_an_import_without_a_ready_profile_queues_nothing(client, auth_headers, session):
    """A user still importing links has not asked for scores, and must not be
    handed failures for a run they never requested."""
    client.patch("/auth/me", headers=auth_headers, json={"ai_consent": True})

    response = _import(client, auth_headers, url="https://example.com/jobs/3")

    assert response.status_code == 201, response.text
    vacancy_id = response.json()["vacancy_id"]
    assert (
        client.get(f"/vacancies/{vacancy_id}/matches", headers=auth_headers).json() == []
    )


def test_an_import_without_consent_queues_nothing(client, auth_headers, session, ready):
    from app.users.models import User

    session.execute(update(User).values(ai_consent_at=None))
    session.commit()

    response = _import(client, auth_headers, url="https://example.com/jobs/4")

    vacancy_id = response.json()["vacancy_id"]
    assert client.get(f"/vacancies/{vacancy_id}/matches", headers=auth_headers).json() == []


def test_an_imported_vacancy_without_a_description_queues_nothing(
    client, auth_headers, session, ready
):
    response = _import(
        client, auth_headers, url="https://example.com/jobs/5", description="Backend dev."
    )

    vacancy_id = response.json()["vacancy_id"]
    assert client.get(f"/vacancies/{vacancy_id}/matches", headers=auth_headers).json() == []


def test_pressing_analyze_after_an_automatic_run_reuses_it(client, auth_headers, session, ready):
    imported = _import(client, auth_headers, url="https://example.com/jobs/6").json()
    provider = MockAIProvider(EVIDENCE)
    _drain(session, provider)

    manual = client.post(
        f"/vacancies/{imported['vacancy_id']}/match", headers=auth_headers, json={}
    )

    assert manual.status_code == 200, manual.text
    assert manual.json()["status"] == "completed"
    assert len(provider.requests) == 1


# --- staleness ------------------------------------------------------------


def test_a_fresh_analysis_is_not_stale(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, MockAIProvider(EVIDENCE))

    body = client.get(
        f"/vacancies/{ready['vacancy_id']}/matches/latest", headers=auth_headers
    ).json()
    assert body["is_stale"] is False


def test_editing_the_profile_makes_the_analysis_stale(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, MockAIProvider(EVIDENCE))

    client.put(
        "/career-profile",
        headers=auth_headers,
        json={"data": {**PROFILE, "current_location": "Porto"}},
    )

    body = client.get(
        f"/vacancies/{ready['vacancy_id']}/matches/latest", headers=auth_headers
    ).json()
    assert body["is_stale"] is True


def test_editing_the_vacancy_makes_the_analysis_stale(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, MockAIProvider(EVIDENCE))

    client.patch(
        f"/vacancies/{ready['vacancy_id']}",
        headers=auth_headers,
        json={"description": DESCRIPTION + " We also expect fluent German."},
    )

    body = client.get(
        f"/vacancies/{ready['vacancy_id']}/matches/latest", headers=auth_headers
    ).json()
    assert body["is_stale"] is True


# --- summaries for the list -----------------------------------------------


def test_summary_returns_the_latest_verdict_per_vacancy(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, MockAIProvider(EVIDENCE))

    response = client.get(
        "/vacancy-matches/summary",
        headers=auth_headers,
        params={"vacancy_ids": ready["vacancy_id"]},
    )

    assert response.status_code == 200, response.text
    assert response.json() == [
        {
            "vacancy_id": ready["vacancy_id"],
            "status": "completed",
            "score": 100,
            "verdict": "apply",
            "confidence": "high",
            "is_stale": False,
        }
    ]


def test_summary_reports_only_the_newest_analysis(client, auth_headers, session, ready):
    provider = MockAIProvider(EVIDENCE, {**EVIDENCE, "findings": EVIDENCE["findings"][:1]})
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, provider)
    client.post(
        f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={"force": True}
    )
    _drain(session, provider)

    body = client.get(
        "/vacancy-matches/summary",
        headers=auth_headers,
        params={"vacancy_ids": ready["vacancy_id"]},
    ).json()

    history = client.get(f"/vacancies/{ready['vacancy_id']}/matches", headers=auth_headers).json()
    assert len(history) == 2
    assert len(body) == 1
    assert body[0]["score"] == history[0]["score"]


def test_summary_skips_vacancies_without_an_analysis(client, auth_headers, ready):
    body = client.get(
        "/vacancy-matches/summary",
        headers=auth_headers,
        params={"vacancy_ids": ready["vacancy_id"]},
    ).json()

    assert body == []


def test_summary_is_scoped_to_the_owner(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, MockAIProvider(EVIDENCE))

    email = f"summary-other-{uuid.uuid4().hex[:8]}@test.example"
    client.post("/auth/register", json={"email": email, "password": "password123"})
    token = client.post(
        "/auth/login", json={"email": email, "password": "password123"}
    ).json()["access_token"]

    body = client.get(
        "/vacancy-matches/summary",
        headers={"Authorization": f"Bearer {token}"},
        params={"vacancy_ids": ready["vacancy_id"]},
    ).json()

    assert body == []


# --- ownership ------------------------------------------------------------


def test_analyses_are_private(client, auth_headers, session, ready):
    client.post(f"/vacancies/{ready['vacancy_id']}/match", headers=auth_headers, json={})
    _drain(session, MockAIProvider(EVIDENCE))
    analysis_id = client.get(
        f"/vacancies/{ready['vacancy_id']}/matches/latest", headers=auth_headers
    ).json()["id"]

    email = f"match-other-{uuid.uuid4().hex[:8]}@test.example"
    client.post("/auth/register", json={"email": email, "password": "password123"})
    token = client.post(
        "/auth/login", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    other = {"Authorization": f"Bearer {token}"}

    assert client.get(f"/vacancy-matches/{analysis_id}", headers=other).status_code == 404
    assert (
        client.get(f"/vacancies/{ready['vacancy_id']}/matches", headers=other).status_code == 404
    )
