from fastapi import APIRouter, HTTPException, status

from app.auth.dependencies import CurrentUser, DbSession
from app.events.names import CLIENT_ALLOWED_EVENTS
from app.events.schemas import EventIn
from app.events.service import record_event

router = APIRouter()

_MAX_PROPERTY_KEYS = 10
_MAX_STR_VALUE_LEN = 200


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
def create_event(data: EventIn, current_user: CurrentUser, db: DbSession) -> None:
    if data.name not in CLIENT_ALLOWED_EVENTS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Event name is not allowed"
        )
    if len(data.properties) > _MAX_PROPERTY_KEYS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Too many property keys"
        )
    if any(
        isinstance(value, str) and len(value) > _MAX_STR_VALUE_LEN
        for value in data.properties.values()
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Property value is too long"
        )
    record_event(db, data.name, user_id=current_user.id, properties=data.properties)
    db.commit()
