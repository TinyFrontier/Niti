"""OpenRouter implementation of `AIProvider`.

One OpenAI-compatible endpoint fronts every vendor, so the model is a config
value rather than a code path. No SDK: the request is a single POST, and httpx
is already a dependency.

Nothing here logs the prompt or the answer, and provider error bodies are never
copied into exceptions — only status codes, which cannot carry user content.
"""

import json
import re
import time

import httpx

from app.ai import schema
from app.ai.provider import (
    INVALID_RESPONSE,
    NOT_CONFIGURED,
    RATE_LIMITED,
    TIMEOUT,
    TRUNCATED,
    UNAVAILABLE,
    AIError,
    JSONRequest,
    JSONResponse,
)
from app.core.config import get_settings

# Test seam: tests inject an httpx.MockTransport here, mirroring app.importer.fetcher.
_transport: httpx.BaseTransport | None = None

# Models without native JSON-schema support tend to wrap the object in a fence.
_JSON_FENCE = re.compile(r"^\s*```(?:json)?\s*(?P<body>.*?)\s*```\s*$", re.DOTALL)


class OpenRouterProvider:
    def complete_json(self, request: JSONRequest) -> JSONResponse:
        settings = get_settings()
        if not settings.open_router_api_key:
            raise AIError(NOT_CONFIGURED, "AI provider is not configured")

        model = request.model or settings.ai_model
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": request.system},
                {"role": "user", "content": request.user},
            ],
            # Honoured by models that support it; the caller validates regardless,
            # because support varies across the OpenRouter catalogue.
            #
            # strict=False on purpose: strict mode accepts only a restricted schema
            # subset (every object closed, every property required), which Pydantic's
            # generated schema does not satisfy — sending strict=True makes
            # OpenAI-family models reject the request outright. The schema stays a
            # strong hint, and our own validation is the actual guarantee.
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": request.schema_name,
                    "strict": False,
                    "schema": schema.for_provider(request.schema),
                },
            },
            "max_tokens": request.max_tokens,
            # Structured extraction should not be creative.
            "temperature": 0,
        }
        headers = {
            "Authorization": f"Bearer {settings.open_router_api_key}",
            # OpenRouter attribution headers; neither carries user data.
            "HTTP-Referer": settings.frontend_url,
            "X-Title": "Niti",
        }

        started = time.monotonic()
        try:
            with httpx.Client(
                transport=_transport, timeout=settings.ai_timeout_seconds
            ) as client:
                response = client.post(
                    f"{settings.ai_base_url}/chat/completions", json=payload, headers=headers
                )
        except httpx.TimeoutException as exc:
            raise AIError(TIMEOUT, "AI provider timed out") from exc
        except httpx.HTTPError as exc:
            raise AIError(UNAVAILABLE, "AI provider is unreachable") from exc
        duration_ms = int((time.monotonic() - started) * 1000)

        if response.status_code == 429:
            raise AIError(RATE_LIMITED, "AI provider rate limit reached")
        if response.status_code >= 400:
            # The body may quote the prompt back, so only the status is reported.
            raise AIError(UNAVAILABLE, f"AI provider returned {response.status_code}")

        content, usage = _unpack(response)
        return JSONResponse(
            data=_parse_object(content),
            model=model,
            duration_ms=duration_ms,
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
        )


def _unpack(response: httpx.Response) -> tuple[str, dict]:
    try:
        body = response.json()
        choice = body["choices"][0]
        message = choice["message"]
        content = message["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise AIError(INVALID_RESPONSE, "AI provider returned an unexpected envelope") from exc

    if isinstance(content, list):
        # some providers answer with typed parts instead of a plain string
        content = "".join(
            part.get("text", "") for part in content if isinstance(part, dict)
        )
    if not content:
        # A reasoning model spends the token budget on thinking and can return an
        # empty answer. That is a budget problem, not a malformed one, and it
        # deserves its own code so the caller can raise the cap or pick a model
        # that does not think out loud.
        if choice.get("finish_reason") == "length" or message.get("reasoning"):
            raise AIError(TRUNCATED, "AI answer was cut off before any content")
        raise AIError(INVALID_RESPONSE, "AI provider returned an empty answer")
    if not isinstance(content, str):
        raise AIError(INVALID_RESPONSE, "AI provider returned a non-text answer")

    usage = body.get("usage") or {}
    return content, usage if isinstance(usage, dict) else {}


def _parse_object(content: str) -> dict:
    fenced = _JSON_FENCE.match(content)
    if fenced:
        content = fenced.group("body")
    try:
        data = json.loads(content)
    except ValueError as exc:
        raise AIError(INVALID_RESPONSE, "AI answer was not valid JSON") from exc
    if not isinstance(data, dict):
        raise AIError(INVALID_RESPONSE, "AI answer was not a JSON object")
    return data
