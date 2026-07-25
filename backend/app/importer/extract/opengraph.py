"""Extract vacancy fields from Open Graph meta tags and the <title> tag."""

import re

from bs4 import BeautifulSoup

from app.importer.extract.types import ExtractedFields

# og:description shorter than this is almost always a teaser, not the real text
MIN_DESCRIPTION_LENGTH = 120

_TITLE_SEPARATORS = (" — ", " – ", " at ", " - ", " | ")


def _og(soup: BeautifulSoup, name: str) -> str | None:
    meta = soup.find("meta", attrs={"property": name}) or soup.find(
        "meta", attrs={"name": name}
    )
    if meta:
        content = meta.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return None


def _strip_site_suffix(title: str, site_name: str | None) -> str:
    """Drop a trailing " | LinkedIn" / " - Jobindex" style site suffix."""
    if not site_name:
        return title
    pattern = re.compile(
        r"\s*[|—–-]\s*" + re.escape(site_name) + r"\s*$", re.IGNORECASE
    )
    return pattern.sub("", title).strip()


def split_title(raw: str) -> tuple[str | None, str | None]:
    """Split "Job — Company" / "Job at Company" / "Job - Company" patterns."""
    for separator in _TITLE_SEPARATORS:
        if separator in raw:
            left, right = raw.split(separator, 1)
            left, right = left.strip(), right.strip()
            if left and right:
                return left, right
            break
    cleaned = raw.strip()
    return (cleaned or None), None


def extract(soup: BeautifulSoup) -> ExtractedFields:
    site_name = _og(soup, "og:site_name")
    raw_title = _og(soup, "og:title")
    if raw_title is None and soup.title and soup.title.string:
        raw_title = soup.title.string.strip()

    title = company = None
    if raw_title:
        title, company = split_title(_strip_site_suffix(raw_title, site_name))

    description = _og(soup, "og:description")
    if description and len(description) < MIN_DESCRIPTION_LENGTH:
        description = None  # teaser only — pipeline will warn about it

    return ExtractedFields(title=title, company_name=company, description=description)
