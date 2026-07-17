def _create_vacancy(client, headers, title="Test Role"):
    response = client.post(
        "/vacancies", headers=headers, json={"title": title, "company_name": "TestCo"}
    )
    assert response.status_code == 201
    return response.json()


def test_application_flow_and_analytics(client, auth_headers):
    vacancy = _create_vacancy(client, auth_headers)

    response = client.post(
        "/applications",
        headers=auth_headers,
        json={"vacancy_id": vacancy["id"], "source": "linkedin"},
    )
    assert response.status_code == 201, response.text
    application = response.json()
    assert application["status"] == "applied"
    assert application["applied_at"] is not None  # auto-filled for non-saved statuses

    # status change reflects in analytics
    client.patch(
        f"/applications/{application['id']}", headers=auth_headers, json={"status": "offer"}
    )
    summary = client.get("/analytics/summary", headers=auth_headers).json()
    assert summary["offers"] == 1
    assert summary["total_applications"] == 1

    by_source = client.get(
        "/analytics/applications-by-source", headers=auth_headers
    ).json()
    assert {"label": "linkedin", "count": 1} in by_source

    funnel = client.get("/analytics/funnel", headers=auth_headers).json()
    assert funnel[0] == {"label": "applied", "count": 1}
    assert funnel[-1] == {"label": "offer", "count": 1}


def test_cannot_use_foreign_vacancy(client, auth_headers):
    vacancy = _create_vacancy(client, auth_headers)

    # a second user must not see or use the first user's vacancy
    import uuid as _uuid

    email = f"other-{_uuid.uuid4().hex[:8]}@test.example"
    client.post("/auth/register", json={"email": email, "password": "password123"})
    token = client.post(
        "/auth/login", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {token}"}

    assert client.get(f"/vacancies/{vacancy['id']}", headers=other_headers).status_code == 404
    response = client.post(
        "/applications", headers=other_headers, json={"vacancy_id": vacancy["id"]}
    )
    assert response.status_code == 404
