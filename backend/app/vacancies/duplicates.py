import uuid

from rapidfuzz import fuzz
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.common.normalize import normalize_company_name, normalize_text, normalize_url
from app.vacancies.models import Vacancy, VacancySource
from app.vacancies.schemas import DuplicateCandidateOut

# similarity(normalized_title) threshold for the SQL pre-filter (pg_trgm, wide net)
SQL_SIMILARITY_THRESHOLD = 0.3
# final combined score threshold for fuzzy candidates
FUZZY_SCORE_THRESHOLD = 0.75
MAX_CANDIDATES = 5


def _candidate(vacancy: Vacancy, score: float, reason: str) -> DuplicateCandidateOut:
    return DuplicateCandidateOut(
        vacancy_id=vacancy.id,
        title=vacancy.title,
        company_name=vacancy.company.name if vacancy.company else None,
        url=vacancy.url,
        score=round(score, 2),
        reason=reason,
    )


def check_duplicates(
    db: Session,
    user_id: uuid.UUID,
    title: str,
    company_name: str | None = None,
    url: str | None = None,
    exclude_id: uuid.UUID | None = None,
) -> list[DuplicateCandidateOut]:
    """Ranked duplicate candidates: URL match > exact normalized match > fuzzy match."""
    found: dict[uuid.UUID, DuplicateCandidateOut] = {}

    def base_query():
        stmt = (
            select(Vacancy)
            .options(selectinload(Vacancy.company))
            .where(Vacancy.user_id == user_id, Vacancy.deleted_at.is_(None))
        )
        if exclude_id is not None:
            stmt = stmt.where(Vacancy.id != exclude_id)
        return stmt

    # 1. exact URL match against the vacancy URL and all its source URLs
    if url:
        normalized = normalize_url(url)
        by_url = db.scalars(
            base_query()
            .outerjoin(VacancySource, VacancySource.vacancy_id == Vacancy.id)
            .where(
                (Vacancy.normalized_url == normalized)
                | (VacancySource.normalized_url == normalized)
            )
        ).unique()
        for vacancy in by_url:
            found[vacancy.id] = _candidate(vacancy, 1.0, "url_match")

    normalized_title = normalize_text(title)
    normalized_company = normalize_company_name(company_name) if company_name else None

    # 2. fuzzy candidates: pg_trgm pre-filter in SQL, then rapidfuzz scoring in Python
    fuzzy_rows = db.scalars(
        base_query().where(
            func.similarity(Vacancy.normalized_title, normalized_title) > SQL_SIMILARITY_THRESHOLD
        )
    ).unique()

    for vacancy in fuzzy_rows:
        if vacancy.id in found:
            continue
        title_ratio = fuzz.token_sort_ratio(normalized_title, vacancy.normalized_title) / 100
        vacancy_company = vacancy.company.normalized_name if vacancy.company else None

        if normalized_company and vacancy_company:
            company_ratio = fuzz.token_sort_ratio(normalized_company, vacancy_company) / 100
            score = 0.65 * title_ratio + 0.35 * company_ratio
        else:
            # no company to compare on one side — judge by title alone, slightly discounted
            score = 0.9 * title_ratio

        if title_ratio == 1.0 and (
            normalized_company is None or normalized_company == vacancy_company
        ):
            found[vacancy.id] = _candidate(vacancy, 0.95, "exact_match")
        elif score >= FUZZY_SCORE_THRESHOLD:
            found[vacancy.id] = _candidate(vacancy, score, "fuzzy_match")

    ranked = sorted(found.values(), key=lambda c: c.score, reverse=True)
    return ranked[:MAX_CANDIDATES]
