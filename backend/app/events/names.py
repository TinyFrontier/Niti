"""Canonical analytics event names.

Server-side events are recorded only by backend code; clients may submit
only the names in CLIENT_ALLOWED_EVENTS.
"""

USER_REGISTERED = "user_registered"
USER_LOGGED_IN = "user_logged_in"
ONBOARDING_COMPLETED = "onboarding_completed"
CAREER_PROFILE_DRAFT_REQUESTED = "career_profile_draft_requested"
CAREER_PROFILE_COMPLETED = "career_profile_completed"
CAREER_PROFILE_SKIPPED = "career_profile_skipped"
IMPORT_PREVIEW_STARTED = "import_preview_started"
IMPORT_PREVIEW_SUCCEEDED = "import_preview_succeeded"
IMPORT_PREVIEW_FAILED = "import_preview_failed"
IMPORT_COMMITTED = "import_committed"
VACANCY_SAVED = "vacancy_saved"
APPLICATION_CREATED = "application_created"

CLIENT_ALLOWED_EVENTS = frozenset(
    {
        "ui_import_opened",
        "ui_paste_link_used",
        "ui_bookmarklet_used",
    }
)
