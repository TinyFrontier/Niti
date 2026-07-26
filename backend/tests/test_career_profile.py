"""Career profile: storage, completeness, onboarding state and AI drafting.

The AI provider is always the mock — no test reaches the network.
"""

import uuid

import pytest

from app.ai.dependencies import get_ai_provider
from app.ai.mock import MockAIProvider
from app.ai.provider import TIMEOUT, AIError
from app.career_profiles import completeness
from app.career_profiles.schemas import CareerProfileData

FULL_PROFILE = {
    "target_roles": ["Backend Engineer"],
    "seniority": "senior",
    "core_skills": [
        {"name": "Python", "level": "expert"},
        {"name": "FastAPI"},
        {"name": "PostgreSQL"},
    ],
    "current_location": "Lisbon",
    "work_formats": ["remote"],
    "languages": [{"language": "English", "level": "c1"}],
}


@pytest.fixture()
def ai(client):
    """Install a mock provider for the app under test."""
    provider = MockAIProvider()
    client.app.dependency_overrides[get_ai_provider] = lambda: provider
    yield provider
    client.app.dependency_overrides.pop(get_ai_provider, None)


def _consent(client, headers):
    response = client.patch("/auth/me", headers=headers, json={"ai_consent": True})
    assert response.status_code == 200, response.text
    return response.json()


def _upload_cv(client, headers, text: str = "x"):
    """Store a CV row with extracted text, bypassing the file parser."""
    from sqlalchemy import update

    from app.common.enums import CVExtractionStatus
    from app.cv_versions.models import CVVersion

    response = client.post(
        "/cv-versions/upload",
        headers=headers,
        files={"file": ("cv.doc", b"legacy", "application/msword")},
        data={"title": "CV"},
    )
    assert response.status_code == 201, response.text
    cv_id = response.json()["id"]

    from app.core.database import get_db

    session = next(client.app.dependency_overrides[get_db]())
    session.execute(
        update(CVVersion)
        .where(CVVersion.id == uuid.UUID(cv_id))
        .values(extraction_status=CVExtractionStatus.COMPLETED, extracted_text=text)
    )
    session.commit()
    return cv_id


# --- completeness ---------------------------------------------------------


def test_empty_profile_is_not_ready():
    data = CareerProfileData()

    assert completeness.completeness(data) == 0
    assert completeness.is_ready_for_matching(data) is False
    assert "Target roles" in completeness.missing_for_matching(data)


def test_required_fields_make_a_profile_ready():
    data = CareerProfileData.model_validate(FULL_PROFILE)

    assert completeness.is_ready_for_matching(data) is True
    assert completeness.missing_for_matching(data) == []
    assert completeness.completeness(data) > 50


def test_two_core_skills_are_not_enough():
    data = CareerProfileData.model_validate(
        {**FULL_PROFILE, "core_skills": [{"name": "Python"}, {"name": "Go"}]}
    )

    assert completeness.missing_for_matching(data) == ["At least 3 core skills"]


def test_blank_and_duplicate_entries_are_cleaned():
    data = CareerProfileData.model_validate(
        {"target_roles": ["Backend Engineer", "  ", "Backend Engineer", " SRE "]}
    )

    assert data.target_roles == ["Backend Engineer", "SRE"]


def test_unknown_fields_are_rejected():
    """extra="forbid" is what makes a drafting model retry instead of inventing."""
    with pytest.raises(ValueError):
        CareerProfileData.model_validate({"salary_expectation_usd": 5000})


# --- storage --------------------------------------------------------------


def test_missing_profile_reads_as_an_empty_one(client, auth_headers):
    response = client.get("/career-profile", headers=auth_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["revision"] == 0
    assert body["confirmed_at"] is None
    assert body["data"]["target_roles"] == []
    assert body["is_ready_for_matching"] is False


def test_patch_merges_one_step_at_a_time(client, auth_headers):
    client.patch("/career-profile", headers=auth_headers, json={"data": {"seniority": "senior"}})
    response = client.patch(
        "/career-profile", headers=auth_headers, json={"data": {"current_location": "Lisbon"}}
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["data"]["seniority"] == "senior"
    assert body["data"]["current_location"] == "Lisbon"
    # a draft in progress must not age an existing job match
    assert body["revision"] == 0


def test_patch_rejects_a_payload_the_schema_would_refuse(client, auth_headers):
    response = client.patch(
        "/career-profile", headers=auth_headers, json={"data": {"seniority": "wizard"}}
    )

    assert response.status_code == 422, response.text


def test_confirm_stamps_the_first_revision(client, auth_headers):
    client.patch("/career-profile", headers=auth_headers, json={"data": FULL_PROFILE})

    response = client.post("/career-profile/confirm", headers=auth_headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["revision"] == 1
    assert body["confirmed_at"] is not None
    assert body["is_ready_for_matching"] is True


def test_editing_a_confirmed_profile_bumps_the_revision(client, auth_headers):
    client.patch("/career-profile", headers=auth_headers, json={"data": FULL_PROFILE})
    client.post("/career-profile/confirm", headers=auth_headers)

    changed = {**FULL_PROFILE, "current_location": "Porto"}
    response = client.put("/career-profile", headers=auth_headers, json={"data": changed})

    assert response.status_code == 200, response.text
    assert response.json()["revision"] == 2


def test_saving_a_confirmed_profile_unchanged_keeps_the_revision(client, auth_headers):
    client.patch("/career-profile", headers=auth_headers, json={"data": FULL_PROFILE})
    client.post("/career-profile/confirm", headers=auth_headers)

    response = client.put("/career-profile", headers=auth_headers, json={"data": FULL_PROFILE})

    assert response.json()["revision"] == 1


def test_profiles_are_private(client, auth_headers):
    client.patch("/career-profile", headers=auth_headers, json={"data": FULL_PROFILE})

    email = f"cp-other-{uuid.uuid4().hex[:8]}@test.example"
    client.post("/auth/register", json={"email": email, "password": "password123"})
    token = client.post(
        "/auth/login", json={"email": email, "password": "password123"}
    ).json()["access_token"]

    response = client.get("/career-profile", headers={"Authorization": f"Bearer {token}"})

    assert response.json()["data"]["target_roles"] == []


# --- onboarding state -----------------------------------------------------


def test_new_user_has_not_finished_onboarding(client, auth_headers):
    body = client.get("/auth/me", headers=auth_headers).json()

    assert body["onboarding_completed_at"] is None
    assert body["ai_consent_at"] is None


def test_recruiter_finishes_onboarding_by_picking_the_role(client, auth_headers):
    """A recruiter has no profile step, so the role is the whole of it."""
    response = client.patch("/auth/me", headers=auth_headers, json={"role": "recruiter"})

    assert response.json()["onboarding_completed_at"] is not None


def test_job_seeker_still_has_steps_left_after_picking_the_role(client, auth_headers):
    response = client.patch("/auth/me", headers=auth_headers, json={"role": "job_seeker"})

    assert response.json()["onboarding_completed_at"] is None


def test_skipping_the_profile_still_lets_the_user_in(client, auth_headers):
    client.patch("/auth/me", headers=auth_headers, json={"role": "job_seeker"})

    response = client.post(
        "/auth/onboarding/complete?skipped_at_step=2", headers=auth_headers
    )

    assert response.status_code == 200, response.text
    assert response.json()["onboarding_completed_at"] is not None


def test_completing_onboarding_twice_keeps_the_first_timestamp(client, auth_headers):
    client.patch("/auth/me", headers=auth_headers, json={"role": "job_seeker"})
    first = client.post("/auth/onboarding/complete", headers=auth_headers).json()

    second = client.post("/auth/onboarding/complete", headers=auth_headers).json()

    assert first["onboarding_completed_at"] == second["onboarding_completed_at"]


def test_consent_is_recorded_once(client, auth_headers):
    first = _consent(client, auth_headers)
    second = _consent(client, auth_headers)

    assert first["ai_consent_at"] is not None
    assert first["ai_consent_at"] == second["ai_consent_at"]


# --- drafting -------------------------------------------------------------


def test_draft_from_free_text(client, auth_headers, ai):
    _consent(client, auth_headers)
    ai.queue({"target_roles": ["Backend Engineer"], "seniority": "senior"})

    response = client.post(
        "/career-profile/draft",
        headers=auth_headers,
        json={"free_text": "Senior backend engineer, seven years of Python"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["data"]["target_roles"] == ["Backend Engineer"]
    assert body["sources"] == {"target_roles": "text_ai", "seniority": "text_ai"}


def test_draft_from_a_cv(client, auth_headers, ai):
    _consent(client, auth_headers)
    cv_id = _upload_cv(client, auth_headers, "Senior Backend Engineer, Python, FastAPI")
    ai.queue({"seniority": "senior"})

    response = client.post(
        "/career-profile/draft", headers=auth_headers, json={"cv_version_id": cv_id}
    )

    assert response.status_code == 200, response.text
    assert response.json()["sources"] == {"seniority": "cv_ai"}
    # the CV text reached the prompt, wrapped as an untrusted document
    assert '<document label="cv">' in ai.requests[0].user
    assert "Senior Backend Engineer, Python, FastAPI" in ai.requests[0].user


def test_draft_from_both_sources_cannot_separate_origins(client, auth_headers, ai):
    _consent(client, auth_headers)
    cv_id = _upload_cv(client, auth_headers, "Backend engineer with seven years of Python")
    ai.queue({"seniority": "senior"})

    response = client.post(
        "/career-profile/draft",
        headers=auth_headers,
        json={"cv_version_id": cv_id, "free_text": "I want remote work only"},
    )

    assert response.json()["sources"] == {"seniority": "ai"}
    assert '<document label="about-me">' in ai.requests[0].user


def test_draft_is_not_saved(client, auth_headers, ai):
    _consent(client, auth_headers)
    ai.queue({"target_roles": ["Backend Engineer"]})
    client.post("/career-profile/draft", headers=auth_headers, json={"free_text": "backend"})

    stored = client.get("/career-profile", headers=auth_headers).json()

    assert stored["data"]["target_roles"] == []
    assert stored["confirmed_at"] is None


def test_draft_needs_consent_first(client, auth_headers, ai):
    response = client.post(
        "/career-profile/draft", headers=auth_headers, json={"free_text": "backend"}
    )

    assert response.status_code == 403, response.text
    assert ai.requests == []


def test_draft_needs_at_least_one_source(client, auth_headers, ai):
    _consent(client, auth_headers)

    response = client.post("/career-profile/draft", headers=auth_headers, json={})

    assert response.status_code == 400, response.text
    assert ai.requests == []


def test_draft_refuses_a_cv_without_extracted_text(client, auth_headers, ai):
    _consent(client, auth_headers)
    response = client.post(
        "/cv-versions/upload",
        headers=auth_headers,
        files={"file": ("cv.doc", b"legacy", "application/msword")},
        data={"title": "CV"},
    )
    cv_id = response.json()["id"]

    response = client.post(
        "/career-profile/draft", headers=auth_headers, json={"cv_version_id": cv_id}
    )

    assert response.status_code == 400, response.text
    assert "unsupported" in response.json()["detail"]
    assert ai.requests == []


def test_draft_refuses_someone_elses_cv(client, auth_headers, ai):
    _consent(client, auth_headers)
    cv_id = _upload_cv(client, auth_headers)

    email = f"cp-thief-{uuid.uuid4().hex[:8]}@test.example"
    client.post("/auth/register", json={"email": email, "password": "password123"})
    token = client.post(
        "/auth/login", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    other = {"Authorization": f"Bearer {token}"}
    _consent(client, other)

    response = client.post(
        "/career-profile/draft", headers=other, json={"cv_version_id": cv_id}
    )

    assert response.status_code == 404, response.text


def test_provider_failure_is_a_gateway_error_with_a_code(client, auth_headers, ai):
    _consent(client, auth_headers)
    ai.queue(AIError(TIMEOUT, "AI provider timed out"))

    response = client.post(
        "/career-profile/draft", headers=auth_headers, json={"free_text": "backend"}
    )

    assert response.status_code == 502, response.text
    assert response.json()["detail"] == TIMEOUT
