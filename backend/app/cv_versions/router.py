import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.auth.dependencies import CurrentUser, DbSession
from app.common.crud import get_owned_or_404, paginate
from app.common.schemas import PageDep, PageOut
from app.common.storage import resolve_path, save_bytes
from app.cv_versions.models import CVVersion
from app.cv_versions.schemas import CVVersionOut, CVVersionUpdate

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("", response_model=PageOut[CVVersionOut])
def list_cv_versions(
    current_user: CurrentUser,
    db: DbSession,
    params: PageDep,
    search: str | None = None,
    language: str | None = None,
) -> PageOut:
    stmt = (
        select(CVVersion)
        .where(CVVersion.user_id == current_user.id, CVVersion.deleted_at.is_(None))
        .order_by(CVVersion.created_at.desc())
    )
    if search:
        stmt = stmt.where(
            CVVersion.title.ilike(f"%{search}%") | CVVersion.specialization.ilike(f"%{search}%")
        )
    if language:
        stmt = stmt.where(CVVersion.language == language)
    items, total = paginate(db, stmt, params.page, params.page_size)
    return PageOut(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("/upload", response_model=CVVersionOut, status_code=status.HTTP_201_CREATED)
def upload_cv_version(
    current_user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
    title: Annotated[str, Form(min_length=1, max_length=255)],
    language: Annotated[str | None, Form(max_length=16)] = None,
    specialization: Annotated[str | None, Form(max_length=255)] = None,
    notes: Annotated[str | None, Form()] = None,
) -> CVVersion:
    original_name = file.filename or "cv"
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{extension}'. Allowed: pdf, doc, docx",
        )
    data = file.file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File larger than 10MB"
        )

    file_path = save_bytes(data, f"cv/{current_user.id}", extension)
    cv = CVVersion(
        user_id=current_user.id,
        title=title,
        language=language,
        specialization=specialization,
        notes=notes,
        file_name=original_name,
        file_path=file_path,
        file_size=len(data),
        mime_type=file.content_type,
    )
    db.add(cv)
    db.commit()
    db.refresh(cv)
    return cv


@router.get("/{cv_version_id}", response_model=CVVersionOut)
def get_cv_version(cv_version_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> CVVersion:
    return get_owned_or_404(db, CVVersion, cv_version_id, current_user.id)


@router.get("/{cv_version_id}/file")
def download_cv_file(
    cv_version_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> FileResponse:
    cv = get_owned_or_404(db, CVVersion, cv_version_id, current_user.id)
    path = resolve_path(cv.file_path)
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File is missing on disk")
    return FileResponse(
        path, filename=cv.file_name, media_type=cv.mime_type or "application/octet-stream"
    )


@router.patch("/{cv_version_id}", response_model=CVVersionOut)
def update_cv_version(
    cv_version_id: uuid.UUID, data: CVVersionUpdate, current_user: CurrentUser, db: DbSession
) -> CVVersion:
    cv = get_owned_or_404(db, CVVersion, cv_version_id, current_user.id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cv, key, value)
    db.commit()
    db.refresh(cv)
    return cv


@router.delete("/{cv_version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cv_version(cv_version_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    """Soft delete: the DB row and file stay so linked applications keep their history."""
    cv = get_owned_or_404(db, CVVersion, cv_version_id, current_user.id)
    cv.deleted_at = datetime.now(UTC)
    db.commit()
