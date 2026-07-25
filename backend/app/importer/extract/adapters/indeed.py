"""Indeed adapter — header data-testid attributes and #jobDescriptionText."""

from bs4 import BeautifulSoup

from app.importer.extract.adapters.base import defensive, select_text
from app.importer.extract.types import ExtractedFields

PLATFORM = "indeed"


@defensive
def extract(soup: BeautifulSoup) -> ExtractedFields:
    return ExtractedFields(
        title=select_text(soup, "h1.jobsearch-JobInfoHeader-title")
        or select_text(soup, "h1[data-testid='jobsearch-JobInfoHeader-title']"),
        company_name=select_text(soup, "[data-testid='inlineHeader-companyName']")
        or select_text(soup, "[data-company-name]"),
        location=select_text(soup, "[data-testid='inlineHeader-companyLocation']")
        or select_text(soup, "[data-testid='job-location']"),
        salary=select_text(soup, "#salaryInfoAndJobType span"),
        description=select_text(soup, "#jobDescriptionText", separator="\n"),
    )
