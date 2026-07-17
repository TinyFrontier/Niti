def test_register_login_me(client):
    email = "auth-flow@test.example"
    response = client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "full_name": "Test User"},
    )
    assert response.status_code == 201
    assert response.json()["email"] == email

    # duplicate email is rejected
    response = client.post("/auth/register", json={"email": email, "password": "password123"})
    assert response.status_code == 409

    response = client.post("/auth/login", json={"email": email, "password": "password123"})
    assert response.status_code == 200
    token = response.json()["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == email


def test_wrong_password_rejected(client):
    client.post("/auth/register", json={"email": "wp@test.example", "password": "password123"})
    response = client.post(
        "/auth/login", json={"email": "wp@test.example", "password": "wrong-password"}
    )
    assert response.status_code == 401


def test_role_onboarding_flow(client, auth_headers):
    # fresh user has no role until onboarding
    response = client.get("/auth/me", headers=auth_headers)
    assert response.json()["role"] is None

    response = client.patch("/auth/me", headers=auth_headers, json={"role": "mix"})
    assert response.status_code == 200
    assert response.json()["role"] == "mix"

    # role can be changed later from settings
    response = client.patch("/auth/me", headers=auth_headers, json={"role": "recruiter"})
    assert response.json()["role"] == "recruiter"


def test_protected_route_requires_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/vacancies").status_code == 401
    assert client.get("/analytics/summary").status_code == 401
