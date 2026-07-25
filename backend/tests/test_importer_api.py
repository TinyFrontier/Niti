"""Importer endpoint tests. fetch_html is monkeypatched — no real network."""

import uuid
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import app.importer.router as importer_router
from app.applications.models import Application, ApplicationStatusHistory
from app.events.models import Event
from app.importer import fetcher
from app.importer.fetcher import FetchError, FetchResult
from app.vacancies.models import Vacancy, VacancySource

FIXTURES = Path(__file__).parent / "fixtures" / "import"


def _patch_fetch(monkeypatch, html: str) -> None:
    monkeypatch.setattr(
        fetcher, "fetch_html", lambda url: FetchResult(final_url=url, html=html, status=200)
    )


def _count(engine, model) -> int:
    with Session(engine) as session:
        return session.scalar(select(func.count()).select_from(model)) or 0


def _event_count(engine, name: str) -> int:
    with Session(engine) as session:
        return (
            session.scalar(select(func.count()).select_from(Event).where(Event.name == name))
            or 0
        )


def test_preview_extracts_fields_without_writing(client, auth_headers, engine, monkeypatch):
    _patch_fetch(monkeypatch, (FIXTURES / "jsonld_generic.html").read_text())
    vacancies_before = _count(engine, Vacancy)
    started_before = _event_count(engine, "import_preview_started")
    succeeded_before = _event_count(engine, "import_preview_succeeded")

    response = client.post(
        "/vacancies/import/preview",
        headers=auth_headers,
        json={"url": "https://careers.example.com/jobs/123?utm_source=email"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["platform"] == "example.com"
    assert body["extraction_method"] == "json_ld"
    assert body["fields"]["title"] == "Senior Python Developer"
    assert body["fields"]["company_name"] == "Acme GmbH"
    assert body["normalized_url"] == "https://careers.example.com/jobs/123"
    assert body["duplicates"] == []

    # preview never writes vacancies or sources
    assert _count(engine, Vacancy) == vacancies_before
    assert _event_count(engine, "import_preview_started") == started_before + 1
    assert _event_count(engine, "import_preview_succeeded") == succeeded_before + 1


def test_preview_reports_duplicates(client, auth_headers, monkeypatch):
    url = "https://careers.example.com/jobs/123"
    created = client.post(
        "/vacancies",
        headers=auth_headers,
        json={"title": "Senior Python Developer", "company_name": "Acme GmbH", "url": url},
    )
    assert created.status_code == 201, created.text

    _patch_fetch(monkeypatch, (FIXTURES / "jsonld_generic.html").read_text())
    response = client.post(
        "/vacancies/import/preview",
        headers=auth_headers,
        json={"url": url + "?utm_campaign=x"},
    )
    assert response.status_code == 200, response.text
    duplicates = response.json()["duplicates"]
    assert duplicates
    assert duplicates[0]["reason"] == "url_match"
    assert duplicates[0]["vacancy_id"] == created.json()["id"]


def test_preview_fetch_error_returns_422_and_records_failure(
    client, auth_headers, engine, monkeypatch
):
    def failing_fetch(url):
        raise FetchError("auth_wall", "The page is behind a login or bot-protection wall")

    monkeypatch.setattr(fetcher, "fetch_html", failing_fetch)
    failed_before = _event_count(engine, "import_preview_failed")
    started_before = _event_count(engine, "import_preview_started")

    response = client.post(
        "/vacancies/import/preview",
        headers=auth_headers,
        json={"url": "https://www.linkedin.com/jobs/view/1"},
    )
    assert response.status_code == 422, response.text
    detail = response.json()["detail"]
    assert detail["error_code"] == "auth_wall"
    assert detail["message"]

    # started is committed before the fetch, failed after it
    assert _event_count(engine, "import_preview_started") == started_before + 1
    assert _event_count(engine, "import_preview_failed") == failed_before + 1


def test_preview_malformed_url_returns_typed_error(client, auth_headers, engine):
    failed_before = _event_count(engine, "import_preview_failed")

    response = client.post(
        "/vacancies/import/preview",
        headers=auth_headers,
        json={"url": "http://["},
    )

    assert response.status_code == 422, response.text
    assert response.json()["detail"]["error_code"] == "blocked_url"
    assert _event_count(engine, "import_preview_failed") == failed_before + 1


def test_import_url_length_matches_storage_limit(client, auth_headers):
    response = client.post(
        "/vacancies/import/preview",
        headers=auth_headers,
        json={"url": "https://example.com/jobs/" + "x" * 1000},
    )
    assert response.status_code == 422


def test_commit_save_creates_vacancy_and_source_only(client, auth_headers, engine):
    applications_before = _count(engine, Application)
    committed_before = _event_count(engine, "import_committed")
    saved_before = _event_count(engine, "vacancy_saved")

    response = client.post(
        "/vacancies/import/commit",
        headers=auth_headers,
        json={
            "url": "https://www.linkedin.com/jobs/view/9876?utm_source=share",
            "platform": "linkedin",
            "mode": "save",
            "fields": {
                "title": "Staff Engineer",
                "company_name": "Wolt",
                "location": "Helsinki",
                "work_format": "hybrid",
            },
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["deduplicated"] is False
    assert body["application_id"] is None

    vacancy = client.get(f"/vacancies/{body['vacancy_id']}", headers=auth_headers).json()
    assert vacancy["title"] == "Staff Engineer"
    assert vacancy["company"]["name"] == "Wolt"
    assert vacancy["work_format"] == "hybrid"
    assert [s["platform"] for s in vacancy["sources"]] == ["linkedin"]

    assert _count(engine, Application) == applications_before
    assert _event_count(engine, "import_committed") == committed_before + 1
    assert _event_count(engine, "vacancy_saved") == saved_before + 1


def test_commit_applied_creates_application(client, auth_headers, engine):
    created_before = _event_count(engine, "application_created")
    response = client.post(
        "/vacancies/import/commit",
        headers=auth_headers,
        json={
            "url": "https://djinni.co/jobs/555-python/",
            "platform": "djinni",
            "mode": "applied",
            "fields": {"title": "Python Engineer", "company_name": "Coolify"},
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["application_id"] is not None

    with Session(engine) as session:
        application = session.get(Application, uuid.UUID(body["application_id"]))
        assert application is not None
        assert application.vacancy_id == uuid.UUID(body["vacancy_id"])
        assert application.status == "applied"
        assert application.applied_at == date.today()
        assert application.source == "djinni"
        history = session.scalars(
            select(ApplicationStatusHistory).where(
                ApplicationStatusHistory.application_id == application.id
            )
        ).all()
        assert len(history) == 1
        assert history[0].from_status is None
        assert history[0].to_status == "applied"
    assert _event_count(engine, "application_created") == created_before + 1


def test_commit_add_source_attaches_to_existing_vacancy(client, auth_headers, engine):
    first = client.post(
        "/vacancies/import/commit",
        headers=auth_headers,
        json={
            "url": "https://hh.ru/vacancy/111",
            "platform": "hh",
            "mode": "save",
            "fields": {"title": "Python-разработчик", "company_name": "Рога и Копыта"},
        },
    )
    vacancy_id = first.json()["vacancy_id"]
    vacancies_before = _count(engine, Vacancy)

    response = client.post(
        "/vacancies/import/commit",
        headers=auth_headers,
        json={
            "url": "https://www.linkedin.com/jobs/view/222",
            "platform": "linkedin",
            "mode": "applied",
            "fields": {"title": "Python-разработчик"},
            "duplicate_action": {"vacancy_id": vacancy_id, "action": "add_source"},
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["deduplicated"] is True
    assert body["vacancy_id"] == vacancy_id
    assert body["application_id"] is not None

    assert _count(engine, Vacancy) == vacancies_before  # no new vacancy
    with Session(engine) as session:
        platforms = set(
            session.scalars(
                select(VacancySource.platform).where(
                    VacancySource.vacancy_id == uuid.UUID(vacancy_id)
                )
            )
        )
        history = session.scalars(
            select(ApplicationStatusHistory).where(
                ApplicationStatusHistory.application_id == uuid.UUID(body["application_id"])
            )
        ).all()
    assert platforms == {"hh", "linkedin"}
    assert len(history) == 1
    assert history[0].to_status == "applied"

    # committing the same normalized url again does not duplicate the source
    again = client.post(
        "/vacancies/import/commit",
        headers=auth_headers,
        json={
            "url": "https://www.linkedin.com/jobs/view/222?utm_source=x",
            "platform": "linkedin",
            "mode": "save",
            "fields": {"title": "Python-разработчик"},
            "duplicate_action": {"vacancy_id": vacancy_id, "action": "add_source"},
        },
    )
    assert again.status_code == 200, again.text
    with Session(engine) as session:
        source_count = session.scalar(
            select(func.count())
            .select_from(VacancySource)
            .where(VacancySource.vacancy_id == uuid.UUID(vacancy_id))
        )
    assert source_count == 2


def test_commit_with_unknown_duplicate_vacancy_writes_nothing(client, auth_headers, engine):
    vacancies_before = _count(engine, Vacancy)
    applications_before = _count(engine, Application)
    committed_before = _event_count(engine, "import_committed")

    response = client.post(
        "/vacancies/import/commit",
        headers=auth_headers,
        json={
            "url": "https://hh.ru/vacancy/999",
            "platform": "hh",
            "mode": "applied",
            "fields": {"title": "Ghost Vacancy"},
            "duplicate_action": {"vacancy_id": str(uuid.uuid4()), "action": "add_source"},
        },
    )
    assert response.status_code == 404, response.text
    # atomic: nothing was persisted by the failed request
    assert _count(engine, Vacancy) == vacancies_before
    assert _count(engine, Application) == applications_before
    assert _event_count(engine, "import_committed") == committed_before


def test_commit_rolls_back_all_staged_rows_on_late_failure(
    client, auth_headers, engine, monkeypatch
):
    vacancies_before = _count(engine, Vacancy)
    applications_before = _count(engine, Application)
    sources_before = _count(engine, VacancySource)
    events_before = _count(engine, Event)
    original_record_event = importer_router.record_event

    def fail_on_commit_event(db, name, **kwargs):
        if name == "import_committed":
            raise RuntimeError("injected late failure")
        original_record_event(db, name, **kwargs)

    monkeypatch.setattr(importer_router, "record_event", fail_on_commit_event)

    with pytest.raises(RuntimeError, match="injected late failure"):
        client.post(
            "/vacancies/import/commit",
            headers=auth_headers,
            json={
                "url": "https://example.com/jobs/rollback",
                "platform": "example.com",
                "mode": "applied",
                "fields": {"title": "Rollback Engineer", "company_name": "Rollback Inc"},
            },
        )

    assert _count(engine, Vacancy) == vacancies_before
    assert _count(engine, Application) == applications_before
    assert _count(engine, VacancySource) == sources_before
    assert _count(engine, Event) == events_before


def test_import_event_properties_are_technical_only(
    client, auth_headers, engine, monkeypatch
):
    _patch_fetch(monkeypatch, (FIXTURES / "jsonld_generic.html").read_text())
    preview = client.post(
        "/vacancies/import/preview",
        headers=auth_headers,
        json={"url": "https://careers.example.com/jobs/privacy"},
    )
    assert preview.status_code == 200, preview.text

    commit = client.post(
        "/vacancies/import/commit",
        headers=auth_headers,
        json={
            "url": "https://careers.example.com/jobs/privacy",
            "platform": "example.com",
            "mode": "save",
            "fields": {
                "title": "Private Title",
                "company_name": "Private Company",
                "description": "Private description",
            },
        },
    )
    assert commit.status_code == 201, commit.text

    with Session(engine) as session:
        events = session.scalars(
            select(Event).where(
                Event.name.in_(
                    [
                        "import_preview_started",
                        "import_preview_succeeded",
                        "import_committed",
                    ]
                )
            )
        ).all()

    forbidden = {"url", "normalized_url", "title", "company", "company_name", "description", "html"}
    assert events
    for event in events:
        assert forbidden.isdisjoint(event.properties)
        if event.name == "import_committed":
            assert event.properties["platform"]
