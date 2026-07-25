import uuid


def _register(client, password="password123"):
    email = f"sess-{uuid.uuid4().hex[:10]}@test.example"
    response = client.post("/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return email


def _login(client, email, password="password123"):
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def test_login_sets_cookie_and_me_works_via_cookie_only(client):
    email = _register(client)
    token = _login(client, email)
    assert client.cookies.get("niti_session") == token
    # no Authorization header: authenticated purely by the cookie
    response = client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == email


def test_me_works_via_bearer_token(client):
    email = _register(client)
    token = _login(client, email)
    client.cookies.clear()
    assert client.get("/auth/me").status_code == 401
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == email


def test_logout_revokes_session(client):
    email = _register(client)
    token = _login(client, email)
    response = client.post("/auth/logout")
    assert response.status_code == 204
    # cookie cleared on the client
    assert client.get("/auth/me").status_code == 401
    # session revoked server-side: the raw token no longer works as Bearer either
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_logout_all_revokes_every_session(client):
    email = _register(client)
    token1 = _login(client, email)
    token2 = _login(client, email)
    client.cookies.clear()
    response = client.post("/auth/logout-all", headers={"Authorization": f"Bearer {token1}"})
    assert response.status_code == 204
    for token in (token1, token2):
        response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401


def test_sessions_listing_marks_current(client):
    email = _register(client)
    _login(client, email)
    _login(client, email)  # cookie now holds the second session
    response = client.get("/auth/sessions")
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) == 2
    assert sum(1 for s in sessions if s["current"]) == 1
    for s in sessions:
        assert set(s) == {"id", "created_at", "last_used_at", "user_agent", "current"}


def test_revoke_session_by_id(client):
    email = _register(client)
    token1 = _login(client, email)
    _login(client, email)
    sessions = client.get("/auth/sessions").json()
    other = next(s for s in sessions if not s["current"])
    response = client.delete(f"/auth/sessions/{other['id']}")
    assert response.status_code == 204
    # the revoked (first) session's token is dead
    client.cookies.clear()
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token1}"})
    assert response.status_code == 401


def test_revoke_session_of_another_user_is_404(client):
    email = _register(client)
    _login(client, email)
    victim_session_id = client.get("/auth/sessions").json()[0]["id"]

    other_email = _register(client)
    client.cookies.clear()
    other_token = _login(client, other_email)
    response = client.delete(
        f"/auth/sessions/{victim_session_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 404


def test_csrf_blocks_foreign_origin_with_cookie(client):
    email = _register(client)
    token = _login(client, email)
    response = client.post("/auth/logout", headers={"Origin": "https://evil.example"})
    assert response.status_code == 403
    # session survived the blocked request
    assert client.get("/auth/me").status_code == 200
    # allowed origin passes
    response = client.post("/auth/logout", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 204
    client.cookies.clear()
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_csrf_ignores_bearer_only_requests(client):
    email = _register(client)
    token = _login(client, email)
    client.cookies.clear()
    # cookie absent: foreign Origin must NOT be blocked for Bearer clients
    response = client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {token}", "Origin": "https://evil.example"},
    )
    assert response.status_code == 204
