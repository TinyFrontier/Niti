import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.auth.models import PasswordResetToken
from app.core.security import hash_token
from app.users.models import User


def _register(client, password="password123"):
    email = f"pr-{uuid.uuid4().hex[:10]}@test.example"
    response = client.post("/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return email


def _request_reset(client, email):
    response = client.post("/auth/password-reset/request", json={"email": email})
    assert response.status_code == 202, response.text
    return response.json()


def _token_from(body):
    return parse_qs(urlparse(body["reset_url"]).query)["token"][0]


def test_request_confirm_and_login_with_new_password(client):
    email = _register(client)
    body = _request_reset(client, email)
    # debug=true in dev: the reset link is exposed in the response
    assert "reset_url" in body
    token = _token_from(body)

    response = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "newpassword456"},
    )
    assert response.status_code == 200
    assert response.json() == {"detail": "Password updated"}

    old = client.post("/auth/login", json={"email": email, "password": "password123"})
    assert old.status_code == 401
    new = client.post("/auth/login", json={"email": email, "password": "newpassword456"})
    assert new.status_code == 200


def test_token_reuse_rejected(client):
    email = _register(client)
    token = _token_from(_request_reset(client, email))
    first = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "newpassword456"},
    )
    assert first.status_code == 200
    second = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "anotherpass789"},
    )
    assert second.status_code == 400


def test_expired_token_rejected(client, engine):
    email = _register(client)
    token = _token_from(_request_reset(client, email))
    with Session(engine) as db:
        db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.token_hash == hash_token(token))
            .values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
        )
        db.commit()
    response = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "newpassword456"},
    )
    assert response.status_code == 400


def test_unknown_email_still_202_without_reset_url(client):
    body = _request_reset(client, f"nobody-{uuid.uuid4().hex[:8]}@test.example")
    assert "reset_url" not in body


def test_google_only_user_gets_no_reset_url(client, engine):
    email = f"gonly-{uuid.uuid4().hex[:10]}@gmail.example"
    with Session(engine) as db:
        db.add(User(email=email, password_hash=None))
        db.commit()
    body = _request_reset(client, email)
    assert "reset_url" not in body


def test_confirm_revokes_existing_sessions(client):
    email = _register(client)
    response = client.post("/auth/login", json={"email": email, "password": "password123"})
    assert response.status_code == 200
    bearer = response.json()["access_token"]
    assert client.get("/auth/me").status_code == 200  # session cookie active

    token = _token_from(_request_reset(client, email))
    response = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "newpassword456"},
    )
    assert response.status_code == 200

    # both the cookie session and the bearer token are revoked
    assert client.get("/auth/me").status_code == 401
    client.cookies.clear()
    assert (
        client.get("/auth/me", headers={"Authorization": f"Bearer {bearer}"}).status_code == 401
    )
