"""Layered extraction pipeline: JSON-LD -> Open Graph -> platform adapter."""

from dataclasses import dataclass, field
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from app.importer.extract import jsonld, opengraph
from app.importer.extract.adapters import registry
from app.importer.extract.types import ExtractedFields, merge
from app.importer.platforms import platform_for_host

MIN_DESCRIPTION_LENGTH = 200

WARNING_NO_TITLE = "Job title not detected — please fill it in"
WARNING_NO_COMPANY = "Company not detected — please fill it in"
WARNING_SHORT_DESCRIPTION = "Description looks incomplete"


@dataclass
class PreviewResult:
    platform: str
    fields: ExtractedFields
    # first layer that produced a title: json_ld | open_graph | adapter | none
    extraction_method: str
    warnings: list[str] = field(default_factory=list)


def run_pipeline(html: str, url: str) -> PreviewResult:
    soup = BeautifulSoup(html, "lxml")
    platform = platform_for_host(urlsplit(url).hostname or "")

    # Ordered extraction layers; earlier layers win on conflicting fields.
    # Seam for future extractors: append ("ai", ai_extract) here to plug in an
    # AI-based fallback without touching the merge/warning logic.
    extractors = [
        ("json_ld", jsonld.extract),
        ("open_graph", opengraph.extract),
    ]
    adapter = registry.get(platform)
    if adapter is not None:
        extractors.append(("adapter", adapter))

    fields = ExtractedFields()
    extraction_method = "none"
    for name, extract in extractors:
        layer = extract(soup)
        if extraction_method == "none" and layer.title:
            extraction_method = name
        fields = merge(fields, layer)

    warnings = []
    if not fields.title:
        warnings.append(WARNING_NO_TITLE)
    if not fields.company_name:
        warnings.append(WARNING_NO_COMPANY)
    if not fields.description or len(fields.description) < MIN_DESCRIPTION_LENGTH:
        warnings.append(WARNING_SHORT_DESCRIPTION)

    return PreviewResult(
        platform=platform,
        fields=fields,
        extraction_method=extraction_method,
        warnings=warnings,
    )
