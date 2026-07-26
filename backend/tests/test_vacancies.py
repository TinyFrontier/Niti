def test_vacancy_crud_with_company_autocreate(client, auth_headers):
    response = client.post(
        "/vacancies",
        headers=auth_headers,
        json={
            "title": "Senior Python Developer",
            "company_name": "Acme Corp",
            "url": "https://www.example.com/jobs/1/?utm_source=x",
            "work_format": "remote",
        },
    )
    assert response.status_code == 201, response.text
    vacancy = response.json()
    assert vacancy["company"]["name"] == "Acme Corp"

    # same normalized company name reuses the company
    response = client.post(
        "/vacancies",
        headers=auth_headers,
        json={"title": "Backend Engineer", "company_name": "ACME corp llc"},
    )
    assert response.json()["company"]["id"] == vacancy["company"]["id"]

    # archive → excluded from default list
    client.post(f"/vacancies/{vacancy['id']}/archive", headers=auth_headers)
    titles = [v["title"] for v in client.get("/vacancies", headers=auth_headers).json()["items"]]
    assert "Senior Python Developer" not in titles

    # soft delete → 404
    assert (
        client.delete(f"/vacancies/{vacancy['id']}", headers=auth_headers).status_code == 204
    )
    assert client.get(f"/vacancies/{vacancy['id']}", headers=auth_headers).status_code == 404


def test_derived_status_tabs_and_stats(client, auth_headers):
    def create(title: str) -> str:
        response = client.post("/vacancies", headers=auth_headers, json={"title": title})
        assert response.status_code == 201, response.text
        return response.json()["id"]

    saved_id = create("Saved role")
    applied_id = create("Applied role")
    interview_id = create("Interview role")
    archived_id = create("Archived role")

    client.post(
        "/applications",
        headers=auth_headers,
        json={"vacancy_id": applied_id, "status": "applied"},
    )
    client.post(
        "/applications",
        headers=auth_headers,
        json={"vacancy_id": interview_id, "status": "technical_interview"},
    )
    client.post(f"/vacancies/{archived_id}/archive", headers=auth_headers)

    def status_of(vacancy_id: str) -> str:
        return client.get(f"/vacancies/{vacancy_id}", headers=auth_headers).json()["status"]

    assert status_of(saved_id) == "saved"
    assert status_of(applied_id) == "applied"
    assert status_of(interview_id) == "interview"
    # archiving wins over whatever the application says
    assert status_of(archived_id) == "archived"

    def titles(**params) -> set[str]:
        response = client.get("/vacancies", headers=auth_headers, params=params)
        return {v["title"] for v in response.json()["items"]}

    assert titles(tab="saved") == {"Saved role"}
    # the applied tab groups everything past "saved", interviews included
    assert titles(tab="applied") == {"Applied role", "Interview role"}
    assert titles(tab="archived") == {"Archived role"}
    assert len(titles(tab="all")) == 4

    stats = client.get("/vacancies/stats", headers=auth_headers).json()
    assert stats == {"all": 4, "saved": 1, "applied": 2, "archived": 1}

    # counters follow the active search
    scoped = client.get("/vacancies/stats", headers=auth_headers, params={"search": "Saved"}).json()
    assert scoped == {"all": 1, "saved": 1, "applied": 0, "archived": 0}

    ordered = client.get("/vacancies", headers=auth_headers, params={"tab": "all", "sort": "title"})
    assert [v["title"] for v in ordered.json()["items"]] == [
        "Applied role",
        "Archived role",
        "Interview role",
        "Saved role",
    ]


def test_duplicate_detection(client, auth_headers):
    client.post(
        "/vacancies",
        headers=auth_headers,
        json={
            "title": "Data Engineer",
            "company_name": "Globex",
            "url": "https://jobs.example.com/de-123?utm_campaign=a",
        },
    )

    # url match ignoring tracking params
    response = client.post(
        "/vacancies/check-duplicates",
        headers=auth_headers,
        json={"title": "anything", "url": "https://jobs.example.com/de-123"},
    )
    candidates = response.json()["candidates"]
    assert candidates and candidates[0]["reason"] == "url_match"

    # fuzzy title match
    response = client.post(
        "/vacancies/check-duplicates",
        headers=auth_headers,
        json={"title": "Sr. Data Engineer", "company_name": "Globex"},
    )
    candidates = response.json()["candidates"]
    assert candidates and candidates[0]["reason"] in ("fuzzy_match", "exact_match")

    # unrelated title finds nothing
    response = client.post(
        "/vacancies/check-duplicates",
        headers=auth_headers,
        json={"title": "Product Designer", "company_name": "Initech"},
    )
    assert response.json()["candidates"] == []
