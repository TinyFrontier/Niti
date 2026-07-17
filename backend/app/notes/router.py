import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, status
from sqlalchemy import select

from app.auth.dependencies import CurrentUser, DbSession
from app.common.crud import get_owned_or_404
from app.common.enums import EntityType
from app.notes.models import Note
from app.notes.schemas import NoteCreate, NoteOut, NoteUpdate

router = APIRouter()


@router.get("", response_model=list[NoteOut])
def list_notes(
    entity_type: EntityType,
    entity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> list[Note]:
    return list(
        db.scalars(
            select(Note)
            .where(
                Note.user_id == current_user.id,
                Note.entity_type == entity_type,
                Note.entity_id == entity_id,
                Note.deleted_at.is_(None),
            )
            .order_by(Note.created_at.desc())
        )
    )


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(data: NoteCreate, current_user: CurrentUser, db: DbSession) -> Note:
    note = Note(user_id=current_user.id, **data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: uuid.UUID, data: NoteUpdate, current_user: CurrentUser, db: DbSession
) -> Note:
    note = get_owned_or_404(db, Note, note_id, current_user.id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    note = get_owned_or_404(db, Note, note_id, current_user.id)
    note.deleted_at = datetime.now(UTC)
    db.commit()
