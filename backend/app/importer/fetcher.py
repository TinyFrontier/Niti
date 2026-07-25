"""SSRF-safe HTML fetcher for the vacancy link importer."""

import ipaddress
import socket
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from urllib.parse import SplitResult, urlsplit

import httpx

TIMEOUT_SECONDS = 10
MAX_BYTES = 2_000_000
MAX_REDIRECTS = 5
USER_AGENT = "Mozilla/5.0 (compatible; NitiBot/1.0; +https://useniti.xyz)"

# Markers of bot-protection / login interstitials (Cloudflare & friends).
_CHALLENGE_TITLE_MARKERS = ("captcha", "challenge", "just a moment", "cf-chl")
# Bare "challenge" is too common in real job descriptions to scan the body for it.
_CHALLENGE_BODY_MARKERS = ("captcha", "just a moment", "cf-chl")
_AUTH_WALL_STATUSES = {401, 403, 999}

# CGNAT range (RFC 6598): not flagged by ipaddress.is_private on Python 3.12.
_CGNAT_NETWORK = ipaddress.ip_network("100.64.0.0/10")

# Optional transport override — tests inject an httpx.MockTransport here.
_transport: httpx.BaseTransport | None = None

# Clock seam so tests can simulate deadline expiry without sleeping.
_monotonic = time.monotonic

# getaddrinfo has no portable per-call timeout. Resolve in a bounded worker
# pool so DNS time is included in the importer's end-to-end deadline.
_dns_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="niti-import-dns")


class FetchError(Exception):
    """Fetch failed; `code` is a machine-readable reason for the API contract."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        # blocked_url | dns_error | timeout | http_error | too_large | not_html | auth_wall
        self.code = code
        self.message = message


@dataclass
class FetchResult:
    final_url: str
    html: str
    status: int


def _is_forbidden_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
        or (ip.version == 4 and ip in _CGNAT_NETWORK)
    )


def validate_url(url: str, *, deadline: float | None = None) -> SplitResult:
    """Reject URLs that could reach internal infrastructure (SSRF protection)."""
    try:
        parts = urlsplit(url.strip())
    except ValueError as exc:
        raise FetchError("blocked_url", f"Malformed URL: {exc}") from exc

    if parts.scheme not in ("http", "https"):
        raise FetchError("blocked_url", "Only http and https URLs are supported")
    try:
        host = parts.hostname
        port = parts.port
    except ValueError as exc:
        raise FetchError("blocked_url", f"Malformed URL: {exc}") from exc
    if not host:
        raise FetchError("blocked_url", "URL has no host")
    if parts.username or parts.password:
        raise FetchError("blocked_url", "URLs with embedded credentials are not allowed")
    if host.lower() == "localhost":
        raise FetchError("blocked_url", "Requests to localhost are not allowed")

    try:
        literal_ip = ipaddress.ip_address(host)
    except ValueError:
        literal_ip = None

    if literal_ip is not None:
        if _is_forbidden_ip(literal_ip):
            raise FetchError("blocked_url", "Requests to private or reserved IPs are not allowed")
        return parts

    resolve_port = port or (443 if parts.scheme == "https" else 80)
    try:
        if deadline is None:
            infos = socket.getaddrinfo(host, resolve_port, proto=socket.IPPROTO_TCP)
        else:
            remaining = deadline - _monotonic()
            if remaining <= 0:
                raise FetchError("timeout", "The page took too long to respond")
            future = _dns_executor.submit(
                socket.getaddrinfo,
                host,
                resolve_port,
                0,
                socket.SOCK_STREAM,
                socket.IPPROTO_TCP,
            )
            try:
                infos = future.result(timeout=remaining)
            except FutureTimeoutError as exc:
                future.cancel()
                raise FetchError("timeout", "DNS resolution took too long") from exc
    except socket.gaierror as exc:
        raise FetchError("dns_error", f"Could not resolve host {host}") from exc
    if not infos:
        raise FetchError("dns_error", f"Could not resolve host {host}")

    for info in infos:
        addr = str(info[4][0]).split("%")[0]  # strip IPv6 zone id
        try:
            resolved = ipaddress.ip_address(addr)
        except ValueError:
            raise FetchError("dns_error", f"Could not resolve host {host}") from None
        if _is_forbidden_ip(resolved):
            raise FetchError(
                "blocked_url", "Host resolves to a private or reserved address"
            )
    return parts


def _detect_auth_wall(response: httpx.Response, html: str) -> bool:
    if response.status_code in _AUTH_WALL_STATUSES:
        return True
    set_cookie = " ".join(response.headers.get_list("set-cookie")).lower()
    if "cf_chl" in set_cookie or "challenge" in set_cookie:
        return True
    lowered = html[:8192].lower()
    title_start = lowered.find("<title")
    if title_start != -1:
        title_end = lowered.find("</title>", title_start)
        title = lowered[title_start : title_end if title_end != -1 else title_start + 512]
        if any(marker in title for marker in _CHALLENGE_TITLE_MARKERS):
            return True
    return any(marker in lowered for marker in _CHALLENGE_BODY_MARKERS)


def _read_response(response: httpx.Response, final_url: str, deadline: float) -> FetchResult:
    status = response.status_code
    if status in _AUTH_WALL_STATUSES:
        raise FetchError("auth_wall", "The page is behind a login or bot-protection wall")
    if status >= 400:
        raise FetchError("http_error", f"The page returned HTTP {status}")

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type.lower():
        raise FetchError(
            "not_html", f"Expected an HTML page, got {content_type or 'no content type'}"
        )

    chunks: list[bytes] = []
    total = 0
    for chunk in response.iter_bytes():
        # A drip-feeding server must not hold us past the total deadline:
        # httpx timeouts are per-read, not end-to-end.
        if _monotonic() > deadline:
            raise FetchError("timeout", "The page took too long to respond")
        total += len(chunk)
        if total > MAX_BYTES:
            raise FetchError("too_large", "The page is larger than 2 MB")
        chunks.append(chunk)
    body = b"".join(chunks)
    html = body.decode(response.charset_encoding or "utf-8", errors="replace")

    if _detect_auth_wall(response, html):
        raise FetchError("auth_wall", "The page is behind a login or bot-protection wall")
    return FetchResult(final_url=final_url, html=html, status=status)


def fetch_html(url: str) -> FetchResult:
    """Fetch a job posting page with SSRF checks, redirect and size limits."""
    deadline = _monotonic() + TIMEOUT_SECONDS
    validate_url(url, deadline=deadline)
    current = url

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    }
    # trust_env=False avoids host credentials/proxies. The client still has an
    # internal cookie jar, so clear it before every hop to prevent a remote
    # page from propagating Set-Cookie state through our redirect loop.
    with httpx.Client(
        follow_redirects=False, trust_env=False, headers=headers, transport=_transport
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            remaining = deadline - _monotonic()
            if remaining <= 0:
                raise FetchError("timeout", "The page took too long to respond")
            try:
                client.cookies.clear()
                with client.stream("GET", current, timeout=remaining) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise FetchError("http_error", "Redirect without a Location header")
                        current = str(httpx.URL(current).join(location))
                        # Re-validate every hop so a redirect cannot point us at
                        # internal infrastructure. Residual risk (accepted): DNS
                        # rebinding between this check and the actual connect
                        # (TOCTOU) — mitigating it would require pinning the
                        # resolved IP into the transport layer.
                        validate_url(current, deadline=deadline)
                        continue
                    return _read_response(response, current, deadline)
            except FetchError:
                raise
            except (httpx.InvalidURL, httpx.UnsupportedProtocol, ValueError) as exc:
                # e.g. "http://0177.0.0.1/" passes DNS-based validation but is
                # rejected by httpx's stricter URL parser — surface as a 422,
                # not a 500.
                raise FetchError("blocked_url", f"URL rejected by HTTP client: {exc}") from exc
            except httpx.TimeoutException as exc:
                raise FetchError("timeout", "The page took too long to respond") from exc
            except httpx.HTTPError as exc:
                raise FetchError("http_error", f"Could not fetch the page: {exc}") from exc
        raise FetchError("http_error", f"Too many redirects (more than {MAX_REDIRECTS})")
