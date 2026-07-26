"""Deterministic provider for tests.

Backend tests must never reach the network, so suites that exercise a feature
built on AI queue answers here and override the provider dependency instead.
Tests for the OpenRouter client itself use its httpx transport seam.
"""

from app.ai.provider import UNAVAILABLE, AIError, JSONRequest, JSONResponse


class MockAIProvider:
    def __init__(self, *answers: dict | AIError) -> None:
        self.answers: list[dict | AIError] = list(answers)
        # every request seen, so tests can assert on what the prompt contained
        self.requests: list[JSONRequest] = []

    def queue(self, answer: dict | AIError) -> None:
        self.answers.append(answer)

    def complete_json(self, request: JSONRequest) -> JSONResponse:
        self.requests.append(request)
        if not self.answers:
            raise AIError(UNAVAILABLE, "mock provider has no queued answer")
        answer = self.answers.pop(0)
        if isinstance(answer, AIError):
            raise answer
        return JSONResponse(
            data=answer, model="mock", duration_ms=0, input_tokens=0, output_tokens=0
        )
