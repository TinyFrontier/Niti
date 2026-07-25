import uuid

from sqlalchemy.orm import Session

from app.applications.models import Application, ApplicationStatusHistory
from app.common.enums import ApplicationStatus


def record_status_change(
    db: Session,
    application: Application,
    from_status: ApplicationStatus | None,
    to_status: ApplicationStatus,
    user_id: uuid.UUID,
) -> None:
    """Stage a status-history row in the caller's transaction (no commit here).

    from_status is None for the initial status set on application creation.
    """
    if application.id is None:
        db.flush()  # a freshly added application gets its PK at flush time
    db.add(
        ApplicationStatusHistory(
            application_id=application.id,
            user_id=user_id,
            from_status=from_status,
            to_status=to_status,
        )
    )
