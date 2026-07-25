import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.events.models import Event


def _event_names(engine, user_id: str) -> list[str]:
    with Session(engine) as session:
        return list(
            session.scalars(
                select(Event.name).where(Event.user_id == uuid.UUID(user_id))
            ).all()
        )


def _register(client, save_vacancy: bool = False) -> str:
    """Register a fresh user (optionally saving a vacancy right away); return user id."""
    email = f"events-{uuid.uuid4().hex[:10]}@test.example"
    response = client.post("/auth/register", json={"email": email, "password": "password123"})
    assert response.status_code == 201, response.text
    user_id = response.json()["id"]
    if save_vacancy:
        response = client.post("/auth/login", json={"email": email, "password": "password123"})
        headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
        response = client.post("/vacancies", headers=headers, json={"title": "Dev"})
        assert response.status_code == 201, response.text
    return user_id


def test_client_event_whitelisted(client, auth_headers):
    response = client.post(
        "/events", headers=auth_headers, json={"name": "ui_import_opened"}
    )
    assert response.status_code == 204


def test_client_event_server_only_name_rejected(client, auth_headers):
    response = client.post(
        "/events", headers=auth_headers, json={"name": "user_registered"}
    )
    assert response.status_code == 422


def test_client_event_oversized_properties_rejected(client, auth_headers):
    too_many_keys = {f"k{i}": i for i in range(11)}
    response = client.post(
        "/events",
        headers=auth_headers,
        json={"name": "ui_import_opened", "properties": too_many_keys},
    )
    assert response.status_code == 422

    response = client.post(
        "/events",
        headers=auth_headers,
        json={"name": "ui_import_opened", "properties": {"v": "x" * 201}},
    )
    assert response.status_code == 422


def test_client_event_requires_auth(client):
    response = client.post("/events", json={"name": "ui_import_opened"})
    assert response.status_code == 401


def test_register_and_login_emit_events(client, engine):
    email = f"events-{uuid.uuid4().hex[:10]}@test.example"
    response = client.post("/auth/register", json={"email": email, "password": "password123"})
    user_id = response.json()["id"]
    client.post("/auth/login", json={"email": email, "password": "password123"})

    names = _event_names(engine, user_id)
    assert names.count("user_registered") == 1
    assert "user_logged_in" in names


def test_vacancy_create_emits_event(client, engine):
    user_id = _register(client, save_vacancy=True)
    assert "vacancy_saved" in _event_names(engine, user_id)


def test_activation_metric(client, engine, auth_headers):
    # one activated user (vacancy saved right after registration) and one not
    _register(client, save_vacancy=True)
    _register(client, save_vacancy=False)

    response = client.get("/analytics/activation", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["registered"] >= 2
    assert data["activated"] >= 1
    assert data["activated"] <= data["registered"]
    assert data["rate"] == pytest.approx(data["activated"] / data["registered"])
