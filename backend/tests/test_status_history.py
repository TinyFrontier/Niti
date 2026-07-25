def _create_vacancy(client, headers, title="History Role"):
    response = client.post(
        "/vacancies", headers=headers, json={"title": title, "company_name": "HistoryCo"}
    )
    assert response.status_code == 201
    return response.json()


def _create_application(client, headers, status="applied"):
    vacancy = _create_vacancy(client, headers)
    response = client.post(
        "/applications",
        headers=headers,
        json={"vacancy_id": vacancy["id"], "status": status},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _history(client, headers, application_id):
    response = client.get(f"/applications/{application_id}/status-history", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_create_records_initial_history_row(client, auth_headers):
    application = _create_application(client, auth_headers, status="saved")

    history = _history(client, auth_headers, application["id"])
    assert len(history) == 1
    assert history[0]["from_status"] is None
    assert history[0]["to_status"] == "saved"
    assert history[0]["changed_at"] is not None


def test_status_patch_appends_history_row(client, auth_headers):
    application = _create_application(client, auth_headers, status="applied")

    response = client.patch(
        f"/applications/{application['id']}",
        headers=auth_headers,
        json={"status": "recruiter_screen"},
    )
    assert response.status_code == 200, response.text

    history = _history(client, auth_headers, application["id"])
    assert len(history) == 2
    assert history[1]["from_status"] == "applied"
    assert history[1]["to_status"] == "recruiter_screen"


def test_patch_without_status_change_adds_no_row(client, auth_headers):
    application = _create_application(client, auth_headers, status="applied")

    # PATCH that does not touch status
    response = client.patch(
        f"/applications/{application['id']}",
        headers=auth_headers,
        json={"notes": "followed up by email"},
    )
    assert response.status_code == 200, response.text
    assert len(_history(client, auth_headers, application["id"])) == 1

    # PATCH that sends the same status value
    response = client.patch(
        f"/applications/{application['id']}",
        headers=auth_headers,
        json={"status": "applied"},
    )
    assert response.status_code == 200, response.text
    assert len(_history(client, auth_headers, application["id"])) == 1


def test_history_is_ordered_by_changed_at(client, auth_headers):
    application = _create_application(client, auth_headers, status="saved")
    for next_status in ["applied", "in_review", "recruiter_screen"]:
        response = client.patch(
            f"/applications/{application['id']}",
            headers=auth_headers,
            json={"status": next_status},
        )
        assert response.status_code == 200, response.text

    history = _history(client, auth_headers, application["id"])
    assert [row["to_status"] for row in history] == [
        "saved",
        "applied",
        "in_review",
        "recruiter_screen",
    ]
    assert [row["from_status"] for row in history] == [None, "saved", "applied", "in_review"]
    changed = [row["changed_at"] for row in history]
    assert changed == sorted(changed)


def test_other_users_history_is_404(client, auth_headers):
    application = _create_application(client, auth_headers)

    import uuid as _uuid

    email = f"other-{_uuid.uuid4().hex[:8]}@test.example"
    client.post("/auth/register", json={"email": email, "password": "password123"})
    token = client.post(
        "/auth/login", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    other_headers = {"Authorization": f"Bearer {token}"}

    response = client.get(
        f"/applications/{application['id']}/status-history", headers=other_headers
    )
    assert response.status_code == 404


def test_funnel_counts_every_reached_stage(client, auth_headers):
    application = _create_application(client, auth_headers, status="saved")
    for next_status in ["applied", "technical_interview", "offer"]:
        response = client.patch(
            f"/applications/{application['id']}",
            headers=auth_headers,
            json={"status": next_status},
        )
        assert response.status_code == 200, response.text

    funnel = client.get("/analytics/funnel", headers=auth_headers).json()
    assert funnel == [
        {"label": "applied", "count": 1},
        {"label": "recruiter_screen", "count": 1},
        {"label": "technical_interview", "count": 1},
        {"label": "final_interview", "count": 1},
        {"label": "offer", "count": 1},
    ]
