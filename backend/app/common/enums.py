from enum import StrEnum


class ApplicationStatus(StrEnum):
    SAVED = "saved"
    APPLIED = "applied"
    IN_REVIEW = "in_review"
    RECRUITER_SCREEN = "recruiter_screen"
    TECHNICAL_INTERVIEW = "technical_interview"
    TEST_TASK = "test_task"
    FINAL_INTERVIEW = "final_interview"
    OFFER = "offer"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    GHOSTED = "ghosted"
    ARCHIVED = "archived"


# statuses that count as "active" pipeline in analytics
ACTIVE_APPLICATION_STATUSES = [
    ApplicationStatus.APPLIED,
    ApplicationStatus.IN_REVIEW,
    ApplicationStatus.RECRUITER_SCREEN,
    ApplicationStatus.TECHNICAL_INTERVIEW,
    ApplicationStatus.TEST_TASK,
    ApplicationStatus.FINAL_INTERVIEW,
]


class UserRole(StrEnum):
    """How the user works with the system; chosen during onboarding."""

    JOB_SEEKER = "job_seeker"
    RECRUITER = "recruiter"
    MIX = "mix"


class ContactType(StrEnum):
    RECRUITER = "recruiter"
    HIRING_MANAGER = "hiring_manager"
    CANDIDATE = "candidate"
    PROFESSIONAL_CONTACT = "professional_contact"
    OTHER = "other"


class ContactStatus(StrEnum):
    NEW = "new"
    CONTACTED = "contacted"
    RESPONDED = "responded"
    ACTIVE_CONVERSATION = "active_conversation"
    FOLLOW_UP_NEEDED = "follow_up_needed"
    NOT_RELEVANT = "not_relevant"
    ARCHIVED = "archived"


class TaskStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class TaskPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class WorkFormat(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    FLEXIBLE = "flexible"
    UNKNOWN = "unknown"


class JobType(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"
    FREELANCE = "freelance"
    UNKNOWN = "unknown"


class EntityType(StrEnum):
    """Entities that notes, tasks, tags and attachments can point to."""

    VACANCY = "vacancy"
    APPLICATION = "application"
    COMPANY = "company"
    CONTACT = "contact"
    INTERVIEW = "interview"


class InterviewFormat(StrEnum):
    VIDEO = "video"
    PHONE = "phone"
    ONSITE = "onsite"
    OTHER = "other"


class InterviewResult(StrEnum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class CommunicationChannel(StrEnum):
    EMAIL = "email"
    TELEGRAM = "telegram"
    LINKEDIN = "linkedin"
    PHONE = "phone"
    OTHER = "other"


class CommunicationDirection(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"
