"""Provider-agnostic access to a model that answers with structured JSON.

Everything above this layer works with `AIProvider`, so swapping the vendor is
one implementation, not a refactor. Prompts and model output never reach the
application logs: failures carry a short code, and successful calls report only
technical metadata (model, duration, token counts).
"""

from dataclasses import dataclass
from typing import Protocol

# error codes — safe to log, safe to show, carry no document content
NOT_CONFIGURED = "ai_not_configured"
TIMEOUT = "ai_timeout"
UNAVAILABLE = "ai_unavailable"
RATE_LIMITED = "ai_rate_limited"
INVALID_RESPONSE = "ai_invalid_response"
# the model used its whole token budget before producing an answer
TRUNCATED = "ai_truncated"


class AIError(Exception):
    """Machine-readable failure. `code` is what the API and telemetry may expose."""

    def __init__(self, code: str, message: str | None = None) -> None:
        super().__init__(message or code)
        self.code = code


@dataclass(frozen=True)
class JSONRequest:
    system: str
    user: str
    # JSON Schema the answer must satisfy; also sent to the provider when supported
    schema: dict
    schema_name: str
    # per-call override: cheap extraction and careful matching don't need the same model
    model: str | None = None
    max_tokens: int = 4096


@dataclass(frozen=True)
class JSONResponse:
    data: dict
    model: str
    duration_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None

    def telemetry(self) -> dict[str, object]:
        """Technical metadata only — never prompt, answer or document content."""
        return {
            "model": self.model,
            "duration_ms": self.duration_ms,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
        }


class AIProvider(Protocol):
    def complete_json(self, request: JSONRequest) -> JSONResponse: ...
