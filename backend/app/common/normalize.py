import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_LEGAL_SUFFIXES = re.compile(
    r"\b(llc|inc|ltd|gmbh|s\.?a\.?|b\.?v\.?|oy|ab|ooo|ооо|зао|оао|пао|ип)\b\.?",
    re.IGNORECASE,
)
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_SPACES = re.compile(r"\s+")

_TRACKING_PARAMS = {"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"}


def normalize_text(value: str) -> str:
    value = value.lower()
    value = _PUNCT.sub(" ", value)
    return _SPACES.sub(" ", value).strip()


def normalize_company_name(value: str) -> str:
    value = value.lower()
    value = _LEGAL_SUFFIXES.sub(" ", value)
    value = _PUNCT.sub(" ", value)
    return _SPACES.sub(" ", value).strip()


def normalize_url(value: str) -> str:
    """Canonical form for URL comparison: lowercase host, no www, no tracking params,
    no trailing slash, no fragment."""
    parts = urlsplit(value.strip())
    host = parts.netloc.lower().removeprefix("www.")
    query = urlencode(
        [(k, v) for k, v in parse_qsl(parts.query) if k.lower() not in _TRACKING_PARAMS]
    )
    path = parts.path.rstrip("/")
    return urlunsplit((parts.scheme.lower() or "https", host, path, query, ""))
