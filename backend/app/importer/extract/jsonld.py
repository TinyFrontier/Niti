"""Extract vacancy fields from schema.org JobPosting JSON-LD blocks."""

import json
import re
from collections.abc import Iterator
from typing import Any

from bs4 import BeautifulSoup

from app.importer.extract.types import ExtractedFields, merge

_EMPLOYMENT_TYPE_MAP = {
    "FULL_TIME": "full_time",
    "FULLTIME": "full_time",
    "PART_TIME": "part_time",
    "PARTTIME": "part_time",
    "CONTRACT": "contract",
    "CONTRACTOR": "contract",
    "TEMPORARY": "contract",
    "INTERN": "internship",
    "INTERNSHIP": "internship",
    "FREELANCE": "freelance",
    "PER_DIEM": "freelance",
}

_BLANK_RUNS = re.compile(r"\n\s*\n+")


def _iter_nodes(data: Any) -> Iterator[dict]:
    """Walk JSON-LD data: top-level lists and @graph arrays."""
    if isinstance(data, list):
        for item in data:
            yield from _iter_nodes(item)
    elif isinstance(data, dict):
        yield data
        yield from _iter_nodes(data.get("@graph"))


def _is_job_posting(node: dict) -> bool:
    node_type = node.get("@type")
    types = node_type if isinstance(node_type, list) else [node_type]
    return any(isinstance(t, str) and t.lower() == "jobposting" for t in types)


def _first(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _text(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def strip_html(value: str) -> str:
    """Plain text from an HTML fragment, blank runs collapsed."""
    text = BeautifulSoup(value, "lxml").get_text("\n")
    return _BLANK_RUNS.sub("\n\n", text).strip()


def _company(node: dict) -> str | None:
    org = _first(node.get("hiringOrganization"))
    if isinstance(org, dict):
        return _text(org.get("name"))
    return _text(org)


def _location(node: dict) -> str | None:
    place = _first(node.get("jobLocation"))
    if not isinstance(place, dict):
        return _text(place)
    address = _first(place.get("address"))
    if not isinstance(address, dict):
        return _text(address)
    country = address.get("addressCountry")
    if isinstance(country, dict):
        country = country.get("name")
    parts = [
        _text(address.get("addressLocality")),
        _text(address.get("addressRegion")),
        _text(country),
    ]
    joined = ", ".join(p for p in parts if p)
    return joined or None


def _format_amount(value: Any) -> str | None:
    if isinstance(value, int | float):
        return f"{value:g}"
    return _text(value)


def _salary(node: dict) -> str | None:
    base = _first(node.get("baseSalary"))
    if isinstance(base, str):
        return _text(base)
    if not isinstance(base, dict):
        return None
    currency = _text(base.get("currency")) or ""
    value = _first(base.get("value"))
    if isinstance(value, dict):
        currency = _text(value.get("currency")) or currency
        min_value = _format_amount(value.get("minValue"))
        max_value = _format_amount(value.get("maxValue"))
        single = _format_amount(value.get("value"))
        if min_value and max_value:
            amount = f"{min_value}–{max_value}"
        else:
            amount = single or min_value or max_value
    else:
        amount = _format_amount(value)
    if not amount:
        return None
    return f"{amount} {currency}".strip()


def _job_type(node: dict) -> str | None:
    raw = node.get("employmentType")
    values = raw if isinstance(raw, list) else [raw]
    for value in values:
        if isinstance(value, str):
            mapped = _EMPLOYMENT_TYPE_MAP.get(value.strip().upper().replace("-", "_"))
            if mapped:
                return mapped
    return None


def _work_format(node: dict) -> str | None:
    location_type = _first(node.get("jobLocationType"))
    if isinstance(location_type, str) and location_type.strip().upper() == "TELECOMMUTE":
        return "remote"
    return None


def _from_posting(node: dict) -> ExtractedFields:
    description = _text(node.get("description"))
    return ExtractedFields(
        title=_text(node.get("title")),
        company_name=_company(node),
        location=_location(node),
        salary=_salary(node),
        work_format=_work_format(node),
        job_type=_job_type(node),
        description=strip_html(description) if description else None,
    )


def extract(soup: BeautifulSoup) -> ExtractedFields:
    result = ExtractedFields()
    for script in soup.find_all("script", attrs={"type": re.compile("ld\\+json", re.I)}):
        raw = script.string or script.get_text()
        if not raw:
            continue
        try:
            data = json.loads(raw.strip())
        except (ValueError, TypeError):
            continue
        for node in _iter_nodes(data):
            if _is_job_posting(node):
                result = merge(result, _from_posting(node))
    return result
