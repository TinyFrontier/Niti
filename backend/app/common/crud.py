import uuid

from fastapi import HTTPException, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.core.database import Base


def get_owned_or_404[ModelT: Base](
    db: Session, model: type[ModelT], obj_id: uuid.UUID, user_id: uuid.UUID
) -> ModelT:
    obj = db.get(model, obj_id)
    if obj is None or obj.user_id != user_id or getattr(obj, "deleted_at", None) is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{model.__name__} not found")
    return obj


def paginate(db: Session, stmt: Select, page: int, page_size: int) -> tuple[list, int]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = list(db.scalars(stmt.limit(page_size).offset((page - 1) * page_size)).unique().all())
    return items, total
