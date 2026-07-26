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


class VacancyStatus(StrEnum):
    """Where a vacancy stands. Derived from its latest application, not stored."""

    SAVED = "saved"
    APPLIED = "applied"
    INTERVIEW = "interview"
    OFFER = "offer"
    CLOSED = "closed"
    ARCHIVED = "archived"


class VacancyTab(StrEnum):
    """Coarse grouping behind the tabs on the vacancies page."""

    ALL = "all"
    SAVED = "saved"
    APPLIED = "applied"
    ARCHIVED = "archived"


class VacancySort(StrEnum):
    NEWEST = "newest"
    OLDEST = "oldest"
    TITLE = "title"
    COMPANY = "company"


class UserRole(StrEnum):
    """How the user works with the system; chosen during onboarding."""

    JOB_SEEKER = "job_seeker"
    RECRUITER = "recruiter"
    MIX = "mix"


class Seniority(StrEnum):
    INTERN = "intern"
    JUNIOR = "junior"
    MIDDLE = "middle"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"
    HEAD = "head"


class SkillLevel(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class LanguageLevel(StrEnum):
    A1 = "a1"
    A2 = "a2"
    B1 = "b1"
    B2 = "b2"
    C1 = "c1"
    C2 = "c2"
    NATIVE = "native"


class Relocation(StrEnum):
    NO = "no"
    MAYBE = "maybe"
    YES = "yes"


class SalaryPeriod(StrEnum):
    YEAR = "year"
    MONTH = "month"
    DAY = "day"
    HOUR = "hour"


class ProfileFieldSource(StrEnum):
    """Where a drafted profile field came from, so the UI can mark it unconfirmed."""

    CV_AI = "cv_ai"
    TEXT_AI = "text_ai"
    # both sources were sent in one call, so the origin of a field is not separable
    AI = "ai"


class CVExtractionStatus(StrEnum):
    """Whether the CV's text could be read out of the uploaded document."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    # format we deliberately don't parse (legacy .doc) — the file is still stored
    UNSUPPORTED = "unsupported"


class MatchStatus(StrEnum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class MatchVerdict(StrEnum):
    APPLY = "apply"
    MAYBE = "maybe"
    SKIP = "skip"


class MatchConfidence(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ScoreCategory(StrEnum):
    """Scoring buckets. Each vacancy requirement lands in exactly one."""

    SKILLS = "skills"
    EXPERIENCE = "experience"
    LOCATION = "location"
    COMPENSATION = "compensation"
    DOMAIN = "domain"


class RequirementImportance(StrEnum):
    REQUIRED = "required"
    PREFERRED = "preferred"


class RequirementStatus(StrEnum):
    MET = "met"
    PARTIAL = "partial"
    MISSING = "missing"
    # the vacancy is silent or ambiguous: never a match, and it lowers confidence
    UNKNOWN = "unknown"


class EvidenceSource(StrEnum):
    CV = "cv"
    PROFILE = "profile"


class HardBlockerKind(StrEnum):
    LANGUAGE = "language"
    LOCATION = "location"
    WORK_AUTHORIZATION = "work_authorization"
    SALARY = "salary"
    STACK = "stack"
    RELOCATION = "relocation"
    OTHER = "other"


class NextAction(StrEnum):
    CREATE_APPLICATION = "create_application"
    REVIEW_GAPS = "review_gaps"
    ARCHIVE_VACANCY = "archive_vacancy"


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
