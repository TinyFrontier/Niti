import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.google import GoogleOAuthClient, GoogleUser
from app.auth.models import UserIdentity
from app.core.config import get_settings
from app.users.models import User


@pytest.fixture()
def google_configured(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(settings, "google_client_secret", "test-client-secret")
    return settings


def _mock_exchange(monkeypatch, google_user):
    monkeypatch.setattr(GoogleOAuthClient, "exchange_code", lambda self, code: google_user)


def _start_authorize(client):
    response = client.get("/auth/google/authorize", follow_redirects=False)
    assert response.status_code in (302, 307), response.text
    location = response.headers["location"]
    assert location.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    return parse_qs(urlparse(location).query)["state"][0]


def _callback(client, state, code="test-code"):
    return client.get(
        f"/auth/google/callback?code={code}&state={state}", follow_redirects=False
    )


def test_full_flow_creates_user_and_identity(client, engine, google_configured, monkeypatch):
    sub = f"sub-{uuid.uuid4().hex}"
    email = f"g-{uuid.uuid4().hex[:10]}@gmail.example"
    _mock_exchange(
        monkeypatch, GoogleUser(sub=sub, email=email, email_verified=True, name="G User")
    )
    state = _start_authorize(client)
    response = _callback(client, state)
    assert response.status_code in (302, 307)
    assert response.headers["location"] == f"{google_configured.frontend_url}/"
    assert client.cookies.get("niti_session")

    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == email

    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        assert user.password_hash is None
        assert user.full_name == "G User"
        identity = db.scalar(
            select(UserIdentity).where(UserIdentity.provider_subject == sub)
        )
        assert identity is not None
        assert identity.provider == "google"
        assert identity.user_id == user.id


def test_second_callback_same_sub_reuses_user(client, engine, google_configured, monkeypatch):
    sub = f"sub-{uuid.uuid4().hex}"
    email = f"g-{uuid.uuid4().hex[:10]}@gmail.example"
    _mock_exchange(
        monkeypatch, GoogleUser(sub=sub, email=email, email_verified=True, name=None)
    )
    for _ in range(2):
        state = _start_authorize(client)
        response = _callback(client, state)
        assert response.status_code in (302, 307)

    with Session(engine) as db:
        users = db.scalars(select(User).where(User.email == email)).all()
        assert len(users) == 1
        identities = db.scalars(
            select(UserIdentity).where(UserIdentity.provider_subject == sub)
        ).all()
        assert len(identities) == 1


def test_callback_links_existing_password_user(client, engine, google_configured, monkeypatch):
    email = f"link-{uuid.uuid4().hex[:10]}@test.example"
    response = client.post("/auth/register", json={"email": email, "password": "password123"})
    assert response.status_code == 201

    sub = f"sub-{uuid.uuid4().hex}"
    _mock_exchange(
        monkeypatch, GoogleUser(sub=sub, email=email, email_verified=True, name="Linked")
    )
    state = _start_authorize(client)
    response = _callback(client, state)
    assert response.status_code in (302, 307)
    assert "error=" not in response.headers["location"]

    with Session(engine) as db:
        users = db.scalars(select(User).where(User.email == email)).all()
        assert len(users) == 1  # no duplicate user
        assert users[0].password_hash is not None  # password kept
        identity = db.scalar(
            select(UserIdentity).where(UserIdentity.provider_subject == sub)
        )
        assert identity is not None
        assert identity.user_id == users[0].id


def test_unverified_email_rejected(client, google_configured, monkeypatch):
    _mock_exchange(
        monkeypatch,
        GoogleUser(
            sub=f"sub-{uuid.uuid4().hex}",
            email=f"uv-{uuid.uuid4().hex[:8]}@gmail.example",
            email_verified=False,
            name=None,
        ),
    )
    state = _start_authorize(client)
    response = _callback(client, state)
    assert response.status_code in (302, 307)
    assert response.headers["location"].endswith("/login?error=oauth_email_unverified")


def test_error_param_redirects_cancelled(client, google_configured):
    response = client.get(
        "/auth/google/callback?error=access_denied", follow_redirects=False
    )
    assert response.status_code in (302, 307)
    assert response.headers["location"].endswith("/login?error=oauth_cancelled")


def test_bad_state_redirects_failed(client, google_configured, monkeypatch):
    _mock_exchange(
        monkeypatch,
        GoogleUser(
            sub="x", email="x@gmail.example", email_verified=True, name=None
        ),
    )
    _start_authorize(client)  # sets a valid state cookie
    response = _callback(client, state="not-the-right-state")
    assert response.status_code in (302, 307)
    assert response.headers["location"].endswith("/login?error=oauth_failed")


def test_authorize_without_credentials_is_503(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "")
    monkeypatch.setattr(settings, "google_client_secret", "")
    response = client.get("/auth/google/authorize", follow_redirects=False)
    assert response.status_code == 503
    assert response.json()["detail"] == "Google sign-in is not configured"


def test_login_with_password_rejected_for_google_only_account(client, engine):
    email = f"gonly-{uuid.uuid4().hex[:10]}@gmail.example"
    with Session(engine) as db:
        db.add(User(email=email, password_hash=None))
        db.commit()
    response = client.post("/auth/login", json={"email": email, "password": "whatever123"})
    assert response.status_code == 401
    assert "Google sign-in" in response.json()["detail"]
