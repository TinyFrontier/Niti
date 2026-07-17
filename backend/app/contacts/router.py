import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.applications.models import Application
from app.auth.dependencies import CurrentUser, DbSession
from app.common.crud import get_owned_or_404, paginate
from app.common.enums import ContactStatus, ContactType
from app.common.schemas import PageDep, PageOut
from app.companies.models import Company
from app.contacts.models import CommunicationLog, Contact
from app.contacts.schemas import (
    CommunicationLogCreate,
    CommunicationLogOut,
    ContactCreate,
    ContactOut,
    ContactUpdate,
)

router = APIRouter()


def _loaded(stmt):
    return stmt.options(selectinload(Contact.company))


def _get_loaded(db, contact_id: uuid.UUID, user_id: uuid.UUID) -> Contact:
    contact = db.scalar(
        _loaded(
            select(Contact).where(
                Contact.id == contact_id,
                Contact.user_id == user_id,
                Contact.deleted_at.is_(None),
            )
        )
    )
    if contact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact


@router.get("", response_model=PageOut[ContactOut])
def list_contacts(
    current_user: CurrentUser,
    db: DbSession,
    params: PageDep,
    search: str | None = None,
    contact_type: ContactType | None = None,
    contact_status: Annotated[ContactStatus | None, Query(alias="status")] = None,
    company_id: uuid.UUID | None = None,
) -> PageOut:
    stmt = _loaded(
        select(Contact)
        .where(Contact.user_id == current_user.id, Contact.deleted_at.is_(None))
        .order_by(Contact.created_at.desc())
    )
    if search:
        pattern = f"%{search}%"
        stmt = stmt.outerjoin(Company, Contact.company_id == Company.id).where(
            Contact.first_name.ilike(pattern)
            | Contact.last_name.ilike(pattern)
            | Contact.email.ilike(pattern)
            | Company.name.ilike(pattern)
        )
    if contact_type is not None:
        stmt = stmt.where(Contact.contact_type == contact_type)
    if contact_status is not None:
        stmt = stmt.where(Contact.status == contact_status)
    if company_id is not None:
        stmt = stmt.where(Contact.company_id == company_id)
    items, total = paginate(db, stmt, params.page, params.page_size)
    return PageOut(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
def create_contact(data: ContactCreate, current_user: CurrentUser, db: DbSession) -> Contact:
    if data.company_id is not None:
        get_owned_or_404(db, Company, data.company_id, current_user.id)
    contact = Contact(user_id=current_user.id, **data.model_dump())
    db.add(contact)
    db.commit()
    return _get_loaded(db, contact.id, current_user.id)


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Contact:
    return _get_loaded(db, contact_id, current_user.id)


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: uuid.UUID, data: ContactUpdate, current_user: CurrentUser, db: DbSession
) -> Contact:
    contact = get_owned_or_404(db, Contact, contact_id, current_user.id)
    updates = data.model_dump(exclude_unset=True)
    if updates.get("company_id") is not None:
        get_owned_or_404(db, Company, updates["company_id"], current_user.id)
    for key, value in updates.items():
        setattr(contact, key, value)
    db.commit()
    return _get_loaded(db, contact.id, current_user.id)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    contact = get_owned_or_404(db, Contact, contact_id, current_user.id)
    contact.deleted_at = datetime.now(UTC)
    db.commit()


@router.get("/{contact_id}/communications", response_model=list[CommunicationLogOut])
def list_communications(
    contact_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[CommunicationLog]:
    get_owned_or_404(db, Contact, contact_id, current_user.id)
    return list(
        db.scalars(
            select(CommunicationLog)
            .where(CommunicationLog.contact_id == contact_id)
            .order_by(CommunicationLog.occurred_at.desc())
        )
    )


@router.post(
    "/{contact_id}/communications",
    response_model=CommunicationLogOut,
    status_code=status.HTTP_201_CREATED,
)
def create_communication(
    contact_id: uuid.UUID,
    data: CommunicationLogCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> CommunicationLog:
    get_owned_or_404(db, Contact, contact_id, current_user.id)
    if data.application_id is not None:
        get_owned_or_404(db, Application, data.application_id, current_user.id)
    log = CommunicationLog(user_id=current_user.id, contact_id=contact_id, **data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.delete(
    "/{contact_id}/communications/{communication_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_communication(
    contact_id: uuid.UUID,
    communication_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    get_owned_or_404(db, Contact, contact_id, current_user.id)
    log = db.get(CommunicationLog, communication_id)
    if log is None or log.contact_id != contact_id or log.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Communication not found")
    db.delete(log)
    db.commit()
