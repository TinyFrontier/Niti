from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  (register all mappers before any query runs)
from app.analytics.router import router as analytics_router
from app.applications.router import router as applications_router
from app.auth.router import router as auth_router
from app.companies.router import router as companies_router
from app.contacts.router import router as contacts_router
from app.core.config import get_settings
from app.cv_versions.router import router as cv_versions_router
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

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(companies_router, prefix="/companies", tags=["companies"])
    app.include_router(vacancies_router, prefix="/vacancies", tags=["vacancies"])
    app.include_router(cv_versions_router, prefix="/cv-versions", tags=["cv-versions"])
    app.include_router(applications_router, prefix="/applications", tags=["applications"])
    app.include_router(contacts_router, prefix="/contacts", tags=["contacts"])
    app.include_router(interviews_router, prefix="/interviews", tags=["interviews"])
    app.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
    app.include_router(notes_router, prefix="/notes", tags=["notes"])
    app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
