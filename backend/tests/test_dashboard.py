from datetime import UTC, datetime, timedelta


def _create_vacancy(client, headers, title):
    response = client.post(
        "/vacancies",
        headers=headers,
        json={"title": title, "company_name": f"{title} Co"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_application(client, headers, title, status="applied"):
    vacancy = _create_vacancy(client, headers, title)
    response = client.post(
        "/applications",
        headers=headers,
        json={"vacancy_id": vacancy["id"], "status": status},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_dashboard_summary_weekly_metrics_are_real_and_distinct(client, auth_headers):
    active = _create_application(client, auth_headers, "Active role")
    moving = _create_application(client, auth_headers, "Moving role")

    for next_status in ["in_review", "technical_interview", "offer"]:
        response = client.patch(
            f"/applications/{moving['id']}",
            headers=auth_headers,
            json={"status": next_status},
        )
        assert response.status_code == 200, response.text

    now = datetime.now(UTC)
    week_start = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    interview = client.post(
        "/interviews",
        headers=auth_headers,
        json={
            "application_id": active["id"],
            "scheduled_at": (week_start + timedelta(hours=12)).isoformat(),
            "format": "video",
        },
    )
    assert interview.status_code == 201, interview.text

    task = client.post(
        "/tasks",
        headers=auth_headers,
        json={"title": "Follow up today", "due_date": datetime.now(UTC).date().isoformat()},
    )
    assert task.status_code == 201, task.text

    summary = client.get("/analytics/summary", headers=auth_headers)
    assert summary.status_code == 200, summary.text
    data = summary.json()

    assert data["active_applications_added_this_week"] == 1
    assert data["interviews_this_week"] == 1
    assert data["tasks_due_today"] == 1
    assert data["offers_this_week"] == 1
    assert data["applications_moved_this_week"] == 1


def test_open_only_tasks_excludes_done_cancelled_and_other_users(client, auth_headers):
    for title, status in [
        ("Todo", "todo"),
        ("In progress", "in_progress"),
        ("Done", "done"),
        ("Cancelled", "cancelled"),
    ]:
        response = client.post(
            "/tasks",
            headers=auth_headers,
            json={"title": title, "status": status},
        )
        assert response.status_code == 201, response.text

    response = client.get("/tasks?open_only=true&page_size=10", headers=auth_headers)
    assert response.status_code == 200, response.text
    assert {task["title"] for task in response.json()["items"]} == {"Todo", "In progress"}

    other_headers = _register_other_user(client)
    response = client.post(
        "/tasks",
        headers=other_headers,
        json={"title": "Another user's task", "status": "todo"},
    )
    assert response.status_code == 201, response.text

    response = client.get("/tasks?open_only=true&page_size=10", headers=other_headers)
    assert response.status_code == 200, response.text
    assert {task["title"] for task in response.json()["items"]} == {"Another user's task"}


def _register_other_user(client):
    import uuid

    email = f"dashboard-other-{uuid.uuid4().hex[:8]}@test.example"
    password = "password123"
    response = client.post("/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
