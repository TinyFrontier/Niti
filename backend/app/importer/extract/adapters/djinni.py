"""Djinni.co adapter — no JSON-LD; salary badge and description markup."""

from bs4 import BeautifulSoup

from app.importer.extract.adapters.base import defensive, select_text
from app.importer.extract.types import ExtractedFields

PLATFORM = "djinni"


@defensive
def extract(soup: BeautifulSoup) -> ExtractedFields:
    title = select_text(soup, "h1")
    salary = select_text(soup, ".public-salary-item")
    if title and salary and title.endswith(salary):
        title = title[: -len(salary)].strip(" , ")
    return ExtractedFields(
        title=title,
        company_name=select_text(soup, "a[href*='/jobs/?company=']")
        or select_text(soup, ".job-details--title"),
        location=select_text(soup, ".location-text"),
        salary=salary,
        description=select_text(soup, ".job-post__description-content", separator="\n")
        or select_text(soup, ".job-post-description", separator="\n"),
    )
