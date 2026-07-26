"""Vacancy status is not stored: it is derived from the latest linked application."""

from app.common.enums import ApplicationStatus, VacancyStatus

_FROM_APPLICATION: dict[ApplicationStatus, VacancyStatus] = {
    ApplicationStatus.SAVED: VacancyStatus.SAVED,
    ApplicationStatus.APPLIED: VacancyStatus.APPLIED,
    ApplicationStatus.IN_REVIEW: VacancyStatus.APPLIED,
    ApplicationStatus.RECRUITER_SCREEN: VacancyStatus.INTERVIEW,
    ApplicationStatus.TECHNICAL_INTERVIEW: VacancyStatus.INTERVIEW,
    ApplicationStatus.TEST_TASK: VacancyStatus.INTERVIEW,
    ApplicationStatus.FINAL_INTERVIEW: VacancyStatus.INTERVIEW,
    ApplicationStatus.OFFER: VacancyStatus.OFFER,
    ApplicationStatus.REJECTED: VacancyStatus.CLOSED,
    ApplicationStatus.WITHDRAWN: VacancyStatus.CLOSED,
    ApplicationStatus.GHOSTED: VacancyStatus.CLOSED,
    ApplicationStatus.ARCHIVED: VacancyStatus.ARCHIVED,
}


def status_from_application(application_status: ApplicationStatus | None) -> VacancyStatus:
    if application_status is None:
        return VacancyStatus.SAVED
    return _FROM_APPLICATION.get(application_status, VacancyStatus.APPLIED)


def application_statuses_for(vacancy_status: VacancyStatus) -> list[ApplicationStatus]:
    """Inverse of the mapping above, for filtering in SQL."""
    return [
        app_status
        for app_status, mapped in _FROM_APPLICATION.items()
        if mapped is vacancy_status
    ]
