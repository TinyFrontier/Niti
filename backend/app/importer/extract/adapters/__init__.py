"""Per-platform extraction adapters, keyed by platform slug."""

from collections.abc import Callable

from bs4 import BeautifulSoup

from app.importer.extract.adapters import (
    djinni,
    dou,
    glassdoor,
    hh,
    indeed,
    jobindex,
    linkedin,
    thehub,
)
from app.importer.extract.types import ExtractedFields

registry: dict[str, Callable[[BeautifulSoup], ExtractedFields]] = {
    module.PLATFORM: module.extract
    for module in (djinni, dou, glassdoor, hh, indeed, jobindex, linkedin, thehub)
}
