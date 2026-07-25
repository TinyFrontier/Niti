"""The Hub (thehub.io) adapter — job pages usually ship JSON-LD; this only
patches the gaps: h1 title, the startup profile link, the location badge."""

from bs4 import BeautifulSoup

from app.importer.extract.adapters.base import defensive, select_text
from app.importer.extract.types import ExtractedFields

PLATFORM = "thehub"


@defensive
def extract(soup: BeautifulSoup) -> ExtractedFields:
    return ExtractedFields(
        title=select_text(soup, "h1"),
        # company profile pages live under /startups/<slug>
        company_name=select_text(soup, "a[href*='/startups/']"),
        location=select_text(soup, "[class*='location']"),
        description=select_text(soup, "[class*='description']", separator="\n"),
    )
