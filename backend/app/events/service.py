import uuid

from sqlalchemy.orm import Session

from app.events.models import Event


def record_event(
    db: Session,
    name: str,
    user_id: uuid.UUID | None = None,
    properties: dict | None = None,
) -> None:
    """Stage an analytics event in the caller's transaction (no commit here).

    The event is committed (or rolled back) together with the business write
    that triggered it — call this right before the caller's db.commit().

    Privacy rule (product roadmap): properties are technical diagnostics only —
    never vacancy descriptions, CV content, or other sensitive user data.
    """
    db.add(Event(name=name, user_id=user_id, properties=properties or {}))
