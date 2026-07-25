"""Registry: imports every model so Base.metadata sees all tables (Alembic, seed)."""

from app.applications.models import Application, ApplicationStatusHistory
from app.auth.models import AuthSession, PasswordResetToken, UserIdentity
from app.common.models import Attachment, EntityTag, Tag
from app.companies.models import Company
from app.contacts.models import CommunicationLog, Contact
from app.core.database import Base
from app.cv_versions.models import CVVersion
from app.events.models import Event
from app.interviews.models import Interview
from app.notes.models import Note
from app.tasks.models import Task
from app.users.models import User
from app.vacancies.models import Vacancy, VacancySource

__all__ = [
    "Application",
    "ApplicationStatusHistory",
    "Attachment",
    "AuthSession",
    "Base",
    "CVVersion",
    "CommunicationLog",
    "Company",
    "Contact",
    "EntityTag",
    "Event",
    "Interview",
    "Note",
    "PasswordResetToken",
    "Tag",
    "Task",
    "User",
    "UserIdentity",
    "Vacancy",
    "VacancySource",
]
