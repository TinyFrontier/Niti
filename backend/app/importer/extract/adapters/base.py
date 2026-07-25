"""Small shared helpers for platform adapters.

Adapters are defensive by contract: any surprise in the page structure must
yield empty fields, never an exception.
"""

import functools
from collections.abc import Callable

from bs4 import BeautifulSoup

from app.importer.extract.types import ExtractedFields


def select_text(soup: BeautifulSoup, selector: str, separator: str = " ") -> str | None:
    node = soup.select_one(selector)
    if node is None:
        return None
    text = node.get_text(separator, strip=True)
    return text or None


def defensive(
    fn: Callable[[BeautifulSoup], ExtractedFields],
) -> Callable[[BeautifulSoup], ExtractedFields]:
    """Never let a broken page structure crash the pipeline."""

    @functools.wraps(fn)
    def wrapper(soup: BeautifulSoup) -> ExtractedFields:
        try:
            return fn(soup)
        except Exception:  # noqa: BLE001 — by design: adapters must not fail the import
            return ExtractedFields()

    return wrapper
