"""Jobindex.dk adapter — the JSON-LD layer usually covers title/company;
this fills company/location from the toolbar when JSON-LD is absent."""

from bs4 import BeautifulSoup

from app.importer.extract.adapters.base import defensive, select_text
from app.importer.extract.types import ExtractedFields

PLATFORM = "jobindex"


@defensive
def extract(soup: BeautifulSoup) -> ExtractedFields:
    return ExtractedFields(
        title=select_text(soup, "#jobad_wrapper h1") or select_text(soup, "h1"),
        # company profile links use the /virksomhed/ path
        company_name=select_text(soup, ".jix-toolbar-top__company")
        or select_text(soup, "a[href*='/virksomhed/']"),
        location=select_text(soup, ".jix_robotjob--area")
        or select_text(soup, "p.jobad-location"),
        description=select_text(soup, "#jobad_wrapper .jobad-text", separator="\n")
        or select_text(soup, "#jobad_wrapper", separator="\n"),
    )
