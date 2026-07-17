import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.normalize import normalize_company_name
from app.companies.models import Company


def get_or_create_company(db: Session, user_id: uuid.UUID, name: str) -> Company:
    normalized = normalize_company_name(name)
    company = db.scalar(
        select(Company).where(
            Company.user_id == user_id,
            Company.normalized_name == normalized,
            Company.deleted_at.is_(None),
        )
    )
    if company is None:
        company = Company(user_id=user_id, name=name.strip(), normalized_name=normalized)
        db.add(company)
        db.flush()
    return company
