import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.database import Base, get_db
from app.main import create_app

ADMIN_URL = "postgresql+psycopg://jobsearch:jobsearch@localhost:5432/postgres"
TEST_URL = "postgresql+psycopg://jobsearch:jobsearch@localhost:5432/jobsearch_test"


@pytest.fixture(scope="session")
def engine():
    admin = create_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'jobsearch_test'")
        ).scalar()
        if not exists:
            conn.execute(text("CREATE DATABASE jobsearch_test"))
    admin.dispose()

    test_engine = create_engine(TEST_URL)
    with test_engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
    Base.metadata.drop_all(test_engine)
    Base.metadata.create_all(test_engine)
    yield test_engine
    test_engine.dispose()


@pytest.fixture()
def client(engine):
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    application = create_app()

    def override_get_db():
        with TestSession() as session:
            yield session

    application.dependency_overrides[get_db] = override_get_db
    with TestClient(application) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers(client):
    """Register a fresh user and return Bearer headers."""
    email = f"user-{uuid.uuid4().hex[:10]}@test.example"
    password = "password123"
    response = client.post("/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
