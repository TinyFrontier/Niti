"""HeadHunter (hh.ru & co) adapter — initial-state JSON in a <template> tag,
with data-qa attribute selectors as fallback."""

import json

from bs4 import BeautifulSoup

from app.importer.extract.adapters.base import defensive, select_text
from app.importer.extract.jsonld import strip_html
from app.importer.extract.types import ExtractedFields, merge

PLATFORM = "hh"


def _from_initial_state(soup: BeautifulSoup) -> ExtractedFields:
    template = soup.find("template", id="HH-Lux-InitialState")
    if template is None:
        return ExtractedFields()
    try:
        state = json.loads(template.get_text())
    except (ValueError, TypeError):
        return ExtractedFields()
    vacancy = state.get("vacancyView") if isinstance(state, dict) else None
    if not isinstance(vacancy, dict):
        return ExtractedFields()

    company = vacancy.get("company") or {}
    area = vacancy.get("area") or {}
    compensation = vacancy.get("compensation") or {}
    salary = None
    low, high = compensation.get("from"), compensation.get("to")
    currency = compensation.get("currencyCode") or ""
    if low and high:
        salary = f"{low}–{high} {currency}".strip()
    elif low or high:
        salary = f"{'от' if low else 'до'} {low or high} {currency}".strip()

    description = vacancy.get("description")
    return ExtractedFields(
        title=vacancy.get("name"),
        company_name=company.get("name") if isinstance(company, dict) else None,
        location=area.get("name") if isinstance(area, dict) else None,
        salary=salary,
        description=strip_html(description) if isinstance(description, str) else None,
    )


@defensive
def extract(soup: BeautifulSoup) -> ExtractedFields:
    from_state = _from_initial_state(soup)
    from_dom = ExtractedFields(
        title=select_text(soup, "h1[data-qa='vacancy-title']"),
        company_name=select_text(soup, "[data-qa='vacancy-company-name']"),
        location=select_text(soup, "[data-qa='vacancy-view-location']")
        or select_text(soup, "[data-qa='vacancy-view-raw-address']"),
        salary=select_text(soup, "[data-qa='vacancy-salary']"),
        description=select_text(soup, "[data-qa='vacancy-description']", separator="\n"),
    )
    return merge(from_state, from_dom)
