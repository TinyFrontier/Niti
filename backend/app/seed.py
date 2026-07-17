"""Seed demo data. Run: uv run python -m app.seed"""

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select

from app.common.enums import (
    ApplicationStatus,
    ContactStatus,
    ContactType,
    TaskPriority,
    TaskStatus,
    UserRole,
    WorkFormat,
)
from app.common.normalize import normalize_company_name, normalize_text, normalize_url
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Application, Company, Contact, Interview, Task, User, Vacancy

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"


def main() -> None:
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == DEMO_EMAIL)):
            print(f"Seed skipped: {DEMO_EMAIL} already exists")
            return

        user = User(
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            full_name="Demo User",
            role=UserRole.MIX,
        )
        db.add(user)
        db.flush()

        companies = []
        for name, industry in [
            ("Acme Corp", "Fintech"),
            ("Globex", "E-commerce"),
            ("Initech", "SaaS"),
        ]:
            company = Company(
                user_id=user.id,
                name=name,
                normalized_name=normalize_company_name(name),
                industry=industry,
                rating=4,
            )
            db.add(company)
            companies.append(company)
        db.flush()

        vacancies = []
        vacancy_specs = [
            ("Senior Python Developer", companies[0], "remote", "https://example.com/jobs/1"),
            ("Backend Engineer", companies[1], "hybrid", "https://example.com/jobs/2"),
            ("Full-stack Developer", companies[2], "remote", "https://example.com/jobs/3"),
        ]
        for title, company, fmt, url in vacancy_specs:
            vacancy = Vacancy(
                user_id=user.id,
                company_id=company.id,
                title=title,
                normalized_title=normalize_text(title),
                url=url,
                normalized_url=normalize_url(url),
                work_format=WorkFormat(fmt),
                salary="4000-6000 EUR",
                location="Remote / EU",
            )
            db.add(vacancy)
            vacancies.append(vacancy)
        db.flush()

        app1 = Application(
            user_id=user.id,
            vacancy_id=vacancies[0].id,
            status=ApplicationStatus.RECRUITER_SCREEN,
            applied_at=date.today() - timedelta(days=7),
            source="linkedin",
        )
        app2 = Application(
            user_id=user.id,
            vacancy_id=vacancies[1].id,
            status=ApplicationStatus.APPLIED,
            applied_at=date.today() - timedelta(days=2),
            source="hh",
        )
        db.add_all([app1, app2])
        db.flush()

        db.add(
            Interview(
                user_id=user.id,
                application_id=app1.id,
                scheduled_at=datetime.now(UTC) + timedelta(days=2),
                duration_minutes=45,
                participants="Jane Doe (recruiter)",
            )
        )
        db.add(
            Contact(
                user_id=user.id,
                first_name="Jane",
                last_name="Doe",
                contact_type=ContactType.RECRUITER,
                status=ContactStatus.ACTIVE_CONVERSATION,
                email="jane@acme.example",
                company_id=companies[0].id,
            )
        )
        db.add(
            Task(
                user_id=user.id,
                title="Follow up with Acme recruiter",
                status=TaskStatus.TODO,
                priority=TaskPriority.HIGH,
                due_date=date.today(),
            )
        )

        db.commit()
        print(f"Seeded demo data. Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
