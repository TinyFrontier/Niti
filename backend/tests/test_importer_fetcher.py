"""Unit tests for the SSRF-safe fetcher. Fully offline: DNS is monkeypatched
and HTTP goes through httpx.MockTransport."""

import socket
from concurrent.futures import TimeoutError as FutureTimeoutError

import httpx
import pytest

from app.importer import fetcher
from app.importer.fetcher import MAX_BYTES, FetchError, fetch_html, validate_url

PUBLIC_IP = "93.184.216.34"


def _addrinfo(ip: str):
    return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (ip, 443))]


@pytest.fixture()
def public_dns(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: _addrinfo(PUBLIC_IP))


def _mock_transport(monkeypatch, handler) -> None:
    monkeypatch.setattr(fetcher, "_transport", httpx.MockTransport(handler))


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/x",
        "http://localhost/x",
        "http://10.0.0.1/",
        "http://169.254.169.254/latest",
        "http://100.64.1.1/",  # CGNAT (RFC 6598), not covered by is_private
        "http://[::1]/",
        "ftp://example.com/jobs",
        "file:///etc/passwd",
        "https://user:pw@host.example/",
    ],
)
def test_validate_url_blocked(url):
    with pytest.raises(FetchError) as exc_info:
        validate_url(url)
    assert exc_info.value.code == "blocked_url"


def test_validate_url_hostname_resolving_to_private_is_blocked(monkeypatch):
    monkeypatch.setattr(
        socket, "getaddrinfo", lambda *args, **kwargs: _addrinfo("192.168.1.10")
    )
    with pytest.raises(FetchError) as exc_info:
        validate_url("https://internal.example.com/jobs/1")
    assert exc_info.value.code == "blocked_url"


def test_validate_url_any_private_address_blocks(monkeypatch):
    """One private address among several public ones is enough to reject."""
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *args, **kwargs: _addrinfo(PUBLIC_IP) + _addrinfo("10.1.2.3"),
    )
    with pytest.raises(FetchError) as exc_info:
        validate_url("https://sneaky.example.com/")
    assert exc_info.value.code == "blocked_url"


def test_validate_url_public_hostname_passes(public_dns):
    parts = validate_url("https://example.com/jobs/1")
    assert parts.hostname == "example.com"


def test_validate_url_dns_failure(monkeypatch):
    def boom(*args, **kwargs):
        raise socket.gaierror("no such host")

    monkeypatch.setattr(socket, "getaddrinfo", boom)
    with pytest.raises(FetchError) as exc_info:
        validate_url("https://nope.example.com/")
    assert exc_info.value.code == "dns_error"


def test_validate_url_dns_respects_deadline(monkeypatch):
    class TimedOutFuture:
        def result(self, timeout):
            raise FutureTimeoutError

        def cancel(self):
            return True

    class TimedOutExecutor:
        def submit(self, *args, **kwargs):
            return TimedOutFuture()

    monkeypatch.setattr(fetcher, "_dns_executor", TimedOutExecutor())
    monkeypatch.setattr(fetcher, "_monotonic", lambda: 10.0)

    with pytest.raises(FetchError) as exc_info:
        validate_url("https://slow-dns.example/jobs/1", deadline=11.0)

    assert exc_info.value.code == "timeout"


def test_fetch_html_success(public_dns, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/html; charset=utf-8"},
            content=b"<html><body><h1>Job</h1></body></html>",
        )

    _mock_transport(monkeypatch, handler)
    result = fetch_html("https://example.com/jobs/1")
    assert result.status == 200
    assert "<h1>Job</h1>" in result.html
    assert result.final_url == "https://example.com/jobs/1"


def test_fetch_html_redirect_to_private_blocked(public_dns, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "http://127.0.0.1/steal"})

    _mock_transport(monkeypatch, handler)
    with pytest.raises(FetchError) as exc_info:
        fetch_html("https://example.com/jobs/1")
    assert exc_info.value.code == "blocked_url"


def test_fetch_html_follows_redirect_and_returns_final_url(public_dns, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/old":
            return httpx.Response(301, headers={"location": "https://example.com/new"})
        return httpx.Response(
            200, headers={"content-type": "text/html"}, content=b"<html>ok</html>"
        )

    _mock_transport(monkeypatch, handler)
    result = fetch_html("https://example.com/old")
    assert result.final_url == "https://example.com/new"


def test_fetch_html_does_not_forward_remote_cookies(public_dns, monkeypatch):
    cookies_seen: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        cookies_seen.append(request.headers.get("cookie"))
        if request.url.path == "/old":
            return httpx.Response(
                302,
                headers={
                    "location": "https://example.com/new",
                    "set-cookie": "tracking=remote; Path=/",
                },
            )
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            content=b"<html>ok</html>",
        )

    _mock_transport(monkeypatch, handler)
    result = fetch_html("https://example.com/old")

    assert result.final_url == "https://example.com/new"
    assert cookies_seen == [None, None]


def test_fetch_html_rejects_url_httpx_considers_invalid(public_dns, monkeypatch):
    """"http://0177.0.0.1/" passes getaddrinfo-based validation but httpx's URL
    parser raises InvalidURL, which is not an httpx.HTTPError — it must still
    surface as a FetchError, not a 500."""

    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover — never reached
        return httpx.Response(200, headers={"content-type": "text/html"}, content=b"ok")

    _mock_transport(monkeypatch, handler)
    with pytest.raises(FetchError) as exc_info:
        fetch_html("http://0177.0.0.1/")
    assert exc_info.value.code == "blocked_url"


def test_fetch_html_body_streaming_respects_total_deadline(public_dns, monkeypatch):
    """A drip-feeding server cannot hold the body stream past the 10s deadline."""
    clock = {"now": 0.0}
    monkeypatch.setattr(fetcher, "_monotonic", lambda: clock["now"])

    def handler(request: httpx.Request) -> httpx.Response:
        # By the time the body starts arriving, the total deadline has passed.
        clock["now"] = fetcher.TIMEOUT_SECONDS + 5.0
        return httpx.Response(
            200, headers={"content-type": "text/html"}, content=b"<html>late body</html>"
        )

    _mock_transport(monkeypatch, handler)
    with pytest.raises(FetchError) as exc_info:
        fetch_html("https://example.com/slow")
    assert exc_info.value.code == "timeout"


def test_fetch_html_too_many_redirects(public_dns, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "https://example.com/loop"})

    _mock_transport(monkeypatch, handler)
    with pytest.raises(FetchError) as exc_info:
        fetch_html("https://example.com/loop")
    assert exc_info.value.code == "http_error"
    assert "redirect" in exc_info.value.message.lower()


def test_fetch_html_too_large(public_dns, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            content=b"x" * (MAX_BYTES + 1),
        )

    _mock_transport(monkeypatch, handler)
    with pytest.raises(FetchError) as exc_info:
        fetch_html("https://example.com/huge")
    assert exc_info.value.code == "too_large"


def test_fetch_html_not_html(public_dns, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, headers={"content-type": "application/json"}, content=b"{}"
        )

    _mock_transport(monkeypatch, handler)
    with pytest.raises(FetchError) as exc_info:
        fetch_html("https://example.com/api")
    assert exc_info.value.code == "not_html"


def test_fetch_html_auth_wall_on_999(public_dns, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(999, headers={"content-type": "text/html"}, content=b"denied")

    _mock_transport(monkeypatch, handler)
    with pytest.raises(FetchError) as exc_info:
        fetch_html("https://example.com/jobs/1")
    assert exc_info.value.code == "auth_wall"


def test_fetch_html_auth_wall_on_captcha_body(public_dns, monkeypatch):
    html = (
        "<html><head><title>Just a moment...</title></head>"
        "<body>Please complete the CAPTCHA to continue.</body></html>"
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, headers={"content-type": "text/html"}, content=html.encode()
        )

    _mock_transport(monkeypatch, handler)
    with pytest.raises(FetchError) as exc_info:
        fetch_html("https://example.com/jobs/1")
    assert exc_info.value.code == "auth_wall"


def test_fetch_html_http_error_status(public_dns, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, headers={"content-type": "text/html"}, content=b"boom")

    _mock_transport(monkeypatch, handler)
    with pytest.raises(FetchError) as exc_info:
        fetch_html("https://example.com/jobs/1")
    assert exc_info.value.code == "http_error"
