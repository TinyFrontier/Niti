"""LinkedIn public job page adapter — .top-card-layout selectors."""

from bs4 import BeautifulSoup

from app.importer.extract.adapters.base import defensive, select_text
from app.importer.extract.types import ExtractedFields

PLATFORM = "linkedin"


@defensive
def extract(soup: BeautifulSoup) -> ExtractedFields:
    return ExtractedFields(
        title=select_text(soup, ".top-card-layout__title"),
        company_name=select_text(soup, ".topcard__org-name-link")
        or select_text(soup, ".top-card-layout__second-subline a"),
        location=select_text(soup, ".topcard__flavor--bullet")
        or select_text(soup, ".top-card-layout__second-subline .topcard__flavor"),
        description=select_text(
            soup, ".show-more-less-html__markup", separator="\n"
        )
        or select_text(soup, ".description__text", separator="\n"),
    )
