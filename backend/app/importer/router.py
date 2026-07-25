import time
from dataclasses import asdict
from datetime import date
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Response, status

from app.applications.models import Application
from app.applications.service import record_status_change
from app.auth.dependencies import CurrentUser, DbSession
from app.common.crud import get_owned_or_404
from app.common.enums import ApplicationStatus
from app.common.normalize import normalize_text, normalize_url
from app.companies.service import get_or_create_company
from app.events.names import (
    APPLICATION_CREATED,
    IMPORT_COMMITTED,
    IMPORT_PREVIEW_FAILED,
    IMPORT_PREVIEW_STARTED,
    IMPORT_PREVIEW_SUCCEEDED,
    VACANCY_SAVED,
)
from app.events.service import record_event
from app.importer import fetcher
from app.importer.pipeline import run_pipeline
from app.importer.platforms import platform_for_host
from app.importer.schemas import (
    CommitIn,
    CommitOut,
    PreviewFieldsOut,
    PreviewIn,
    PreviewOut,
)
from app.vacancies.duplicates import check_duplicates
from app.vacancies.models import Vacancy, VacancySource

router = APIRouter()


@router.post("/preview", response_model=PreviewOut)
def preview_import(data: PreviewIn, current_user: CurrentUser, db: DbSession) -> PreviewOut:
    try:
        platform = platform_for_host(urlsplit(data.url).hostname or "")
    except ValueError:
        # The fetcher owns URL validation and will turn malformed input into a
        # typed blocked_url error. Keep event recording safe until then.
        platform = "unknown"

    # Committed on its own so failed fetches still show up in funnel analytics.
    record_event(
        db, IMPORT_PREVIEW_STARTED, user_id=current_user.id, properties={"platform": platform}
    )
    db.commit()

    started = time.monotonic()
    try:
        fetched = fetcher.fetch_html(data.url)
    except fetcher.FetchError as exc:
        duration_ms = int((time.monotonic() - started) * 1000)
        record_event(
            db,
            IMPORT_PREVIEW_FAILED,
            user_id=current_user.id,
            properties={"platform": platform, "error_code": exc.code, "duration_ms": duration_ms},
        )
        db.commit()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error_code": exc.code, "message": exc.message},
        ) from exc

    result = run_pipeline(fetched.html, fetched.final_url)
    fields = result.fields
    duration_ms = int((time.monotonic() - started) * 1000)

    duplicates = []
    if fields.title:
        duplicates = check_duplicates(
            db,
            user_id=current_user.id,
            title=fields.title,
            company_name=fields.company_name,
            url=fetched.final_url,
        )

    record_event(
        db,
        IMPORT_PREVIEW_SUCCEEDED,
        user_id=current_user.id,
        properties={
            "platform": result.platform,
            "extraction_method": result.extraction_method,
            "has_title": fields.title is not None,
            "has_company": fields.company_name is not None,
            "fields_found": sum(1 for value in asdict(fields).values() if value),
            "duration_ms": duration_ms,
        },
    )
    db.commit()

    return PreviewOut(
        url=fetched.final_url,
        normalized_url=normalize_url(fetched.final_url),
        platform=result.platform,
        extraction_method=result.extraction_method,
        fields=PreviewFieldsOut(**asdict(fields)),
        warnings=result.warnings,
        duplicates=duplicates,
    )


@router.post("/commit", response_model=CommitOut, status_code=status.HTTP_201_CREATED)
def commit_import(
    data: CommitIn, current_user: CurrentUser, db: DbSession, response: Response
) -> CommitOut:
    normalized = normalize_url(data.url)
    fields = data.fields

    if data.duplicate_action is not None:
        # Attach this link as another source of an existing vacancy.
        vacancy = get_owned_or_404(db, Vacancy, data.duplicate_action.vacancy_id, current_user.id)
        if normalized not in {source.normalized_url for source in vacancy.sources}:
            db.add(
                VacancySource(
                    vacancy_id=vacancy.id,
                    platform=data.platform,
                    url=data.url,
                    normalized_url=normalized,
                )
            )
        application_id = None
        if data.mode == "applied":
            application = Application(
                user_id=current_user.id,
                vacancy_id=vacancy.id,
                status=ApplicationStatus.APPLIED,
                applied_at=date.today(),
                source=data.platform,
            )
            db.add(application)
            db.flush()
            record_status_change(
                db,
                application,
                None,
                ApplicationStatus.APPLIED,
                current_user.id,
            )
            application_id = application.id
            record_event(
                db,
                APPLICATION_CREATED,
                user_id=current_user.id,
                properties={"status": ApplicationStatus.APPLIED.value},
            )
        record_event(
            db,
            IMPORT_COMMITTED,
            user_id=current_user.id,
            properties={
                "mode": data.mode,
                "platform": data.platform,
                "deduplicated": True,
            },
        )
        db.commit()
        response.status_code = status.HTTP_200_OK
        return CommitOut(vacancy_id=vacancy.id, application_id=application_id, deduplicated=True)

    company_id = None
    if fields.company_name:
        company_id = get_or_create_company(db, current_user.id, fields.company_name).id

    vacancy = Vacancy(
        user_id=current_user.id,
        company_id=company_id,
        title=fields.title,
        normalized_title=normalize_text(fields.title),
        description=fields.description,
        url=data.url,
        normalized_url=normalized,
        location=fields.location,
        salary=fields.salary,
        work_format=fields.work_format,
        job_type=fields.job_type,
        sources=[VacancySource(platform=data.platform, url=data.url, normalized_url=normalized)],
    )
    db.add(vacancy)
    db.flush()

    application_id = None
    if data.mode == "applied":
        application = Application(
            user_id=current_user.id,
            vacancy_id=vacancy.id,
            status=ApplicationStatus.APPLIED,
            applied_at=date.today(),
            source=data.platform,
        )
        db.add(application)
        db.flush()
        record_status_change(
            db,
            application,
            None,
            ApplicationStatus.APPLIED,
            current_user.id,
        )
        application_id = application.id
        record_event(
            db,
            APPLICATION_CREATED,
            user_id=current_user.id,
            properties={"status": ApplicationStatus.APPLIED.value},
        )

    record_event(
        db,
        IMPORT_COMMITTED,
        user_id=current_user.id,
        properties={"mode": data.mode, "platform": data.platform},
    )
    record_event(
        db, VACANCY_SAVED, user_id=current_user.id, properties={"source": "import"}
    )
    db.commit()
    return CommitOut(vacancy_id=vacancy.id, application_id=application_id, deduplicated=False)
