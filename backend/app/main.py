from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import app.models  # noqa: F401  (register all mappers before any query runs)
from app.analytics.router import router as analytics_router
from app.applications.router import router as applications_router
from app.auth.router import router as auth_router
from app.auth.sessions import SESSION_COOKIE
from app.career_profiles.router import router as career_profile_router
from app.companies.router import router as companies_router
from app.contacts.router import router as contacts_router
from app.core.config import get_settings
from app.cv_versions.router import router as cv_versions_router
from app.events.router import router as events_router
from app.interviews.router import router as interviews_router
from app.notes.router import router as notes_router
from app.tasks.router import router as tasks_router
from app.vacancies.router import router as vacancies_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Niti API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def csrf_protect(request: Request, call_next):
        """CSRF guard for cookie-authenticated state changes.

        Only applies when the session cookie is present AND the browser sent an
        Origin header; Bearer-token clients and non-browser requests pass through.
        """
        mutating = request.method in {"POST", "PUT", "PATCH", "DELETE"}
        if mutating and SESSION_COOKIE in request.cookies:
            origin = request.headers.get("origin")
            if (
                origin is not None
                and origin not in settings.cors_origins
                and origin != settings.frontend_url
            ):
                return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        return await call_next(request)

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(companies_router, prefix="/companies", tags=["companies"])
    app.include_router(vacancies_router, prefix="/vacancies", tags=["vacancies"])
    from app.importer.router import router as importer_router  # local: single-edit constraint

    app.include_router(importer_router, prefix="/vacancies/import", tags=["import"])
    app.include_router(cv_versions_router, prefix="/cv-versions", tags=["cv-versions"])
    app.include_router(career_profile_router, prefix="/career-profile", tags=["career-profile"])
    app.include_router(applications_router, prefix="/applications", tags=["applications"])
    app.include_router(contacts_router, prefix="/contacts", tags=["contacts"])
    app.include_router(interviews_router, prefix="/interviews", tags=["interviews"])
    app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
    app.include_router(notes_router, prefix="/notes", tags=["notes"])
    app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
    app.include_router(events_router, prefix="/events", tags=["events"])

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
