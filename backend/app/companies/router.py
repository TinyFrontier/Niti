import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, status
from sqlalchemy import select

from app.auth.dependencies import CurrentUser, DbSession
from app.common.crud import get_owned_or_404, paginate
from app.common.normalize import normalize_company_name
from app.common.schemas import PageDep, PageOut
from app.companies.models import Company
from app.companies.schemas import CompanyCreate, CompanyOut, CompanyUpdate

router = APIRouter()


@router.get("", response_model=PageOut[CompanyOut])
def list_companies(
    current_user: CurrentUser,
    db: DbSession,
    params: PageDep,
    search: str | None = None,
) -> PageOut:
    stmt = (
        select(Company)
        .where(Company.user_id == current_user.id, Company.deleted_at.is_(None))
        .order_by(Company.created_at.desc())
    )
    if search:
        stmt = stmt.where(Company.name.ilike(f"%{search}%"))
    items, total = paginate(db, stmt, params.page, params.page_size)
    return PageOut(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(data: CompanyCreate, current_user: CurrentUser, db: DbSession) -> Company:
    company = Company(
        user_id=current_user.id,
        normalized_name=normalize_company_name(data.name),
        **data.model_dump(),
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Company:
    return get_owned_or_404(db, Company, company_id, current_user.id)


@router.patch("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: uuid.UUID, data: CompanyUpdate, current_user: CurrentUser, db: DbSession
) -> Company:
    company = get_owned_or_404(db, Company, company_id, current_user.id)
    updates = data.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"]:
        updates["normalized_name"] = normalize_company_name(updates["name"])
    for key, value in updates.items():
        setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(company_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    company = get_owned_or_404(db, Company, company_id, current_user.id)
    company.deleted_at = datetime.now(UTC)
    db.commit()
