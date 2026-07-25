"""Glassdoor adapter — data-test attributes on the job details header."""

from bs4 import BeautifulSoup

from app.importer.extract.adapters.base import defensive, select_text
from app.importer.extract.types import ExtractedFields

PLATFORM = "glassdoor"


@defensive
def extract(soup: BeautifulSoup) -> ExtractedFields:
    return ExtractedFields(
        title=select_text(soup, "[data-test='job-title']"),
        company_name=select_text(soup, "[data-test='employer-name']"),
        location=select_text(soup, "[data-test='location']"),
        salary=select_text(soup, "[data-test='detailSalary']"),
        description=select_text(soup, "[class*='jobDescription']", separator="\n"),
    )
