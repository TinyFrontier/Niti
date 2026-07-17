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
