"""jobs.dou.ua adapter — DOU ships no JSON-LD; read the vacancy block markup."""

from bs4 import BeautifulSoup

from app.importer.extract.adapters.base import defensive, select_text
from app.importer.extract.types import ExtractedFields

PLATFORM = "dou"


@defensive
def extract(soup: BeautifulSoup) -> ExtractedFields:
    return ExtractedFields(
        title=select_text(soup, ".b-vacancy h1.g-h2") or select_text(soup, "h1.g-h2"),
        company_name=select_text(soup, ".b-compinfo .l-n a")
        or select_text(soup, ".l-n a"),
        location=select_text(soup, ".sh-info .place"),
        salary=select_text(soup, ".salary"),
        description=select_text(soup, ".b-typo.vacancy-section", separator="\n"),
    )
