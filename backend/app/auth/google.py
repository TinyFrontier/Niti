"""Minimal Google OAuth 2.0 / OpenID Connect client (authorization code flow)."""

import base64
import binascii
import json
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import get_settings

AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
_VALID_ISSUERS = ("https://accounts.google.com", "accounts.google.com")


class GoogleOAuthError(Exception):
    """Any failure while exchanging the code or validating the id_token."""


@dataclass
class GoogleUser:
    sub: str
    email: str
    email_verified: bool
    name: str | None


class GoogleOAuthClient:
    @property
    def configured(self) -> bool:
        settings = get_settings()
        return bool(settings.google_client_id and settings.google_client_secret)

    @property
    def redirect_uri(self) -> str:
        return f"{get_settings().api_base_url}/auth/google/callback"

    def authorize_url(self, state: str) -> str:
        settings = get_settings()
        params = {
            "client_id": settings.google_client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
        }
        return f"{AUTHORIZE_ENDPOINT}?{urlencode(params)}"

    def exchange_code(self, code: str) -> GoogleUser:
        settings = get_settings()
        try:
            response = httpx.post(
                TOKEN_ENDPOINT,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": self.redirect_uri,
                    "grant_type": "authorization_code",
                },
                timeout=10.0,
            )
            response.raise_for_status()
            id_token = response.json()["id_token"]
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            raise GoogleOAuthError("Token exchange with Google failed") from exc
        payload = self._decode_id_token(id_token)
        return GoogleUser(
            sub=payload["sub"],
            email=payload["email"].lower(),
            email_verified=bool(payload.get("email_verified", False)),
            name=payload.get("name"),
        )

    def _decode_id_token(self, id_token: str) -> dict:
        # The id_token comes straight from Google's token endpoint over a direct
        # TLS channel (server-to-server), so its signature does not need to be
        # verified here — TLS already authenticates the source. We still validate
        # the claims (iss / aud / exp) to reject tokens minted for someone else.
        try:
            _, payload_b64, _ = id_token.split(".")
            padded = payload_b64 + "=" * (-len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded))
        except (ValueError, binascii.Error) as exc:
            raise GoogleOAuthError("Malformed id_token") from exc
        if payload.get("iss") not in _VALID_ISSUERS:
            raise GoogleOAuthError("Unexpected id_token issuer")
        if payload.get("aud") != get_settings().google_client_id:
            raise GoogleOAuthError("id_token audience mismatch")
        if not isinstance(payload.get("exp"), (int, float)) or payload["exp"] <= time.time():
            raise GoogleOAuthError("id_token expired")
        if "sub" not in payload or "email" not in payload:
            raise GoogleOAuthError("id_token missing required claims")
        return payload
