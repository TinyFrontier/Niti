"""Turn a model's answer into a validated Pydantic object.

The provider contract stops at "some JSON object". This is where that becomes a
typed value or a clean failure — with one corrective retry, because JSON-schema
support differs across models and a near-miss is the common case, not an outage.
"""

from dataclasses import dataclass, replace

from pydantic import BaseModel, ValidationError

from app.ai.provider import INVALID_RESPONSE, AIError, AIProvider, JSONRequest, JSONResponse

_CORRECTION = (
    "\n\nYour previous answer did not match the required schema: {errors}\n"
    "Answer again with a corrected JSON object only, and no other text."
)


@dataclass(frozen=True)
class StructuredResult[M: BaseModel]:
    value: M
    response: JSONResponse
    retried: bool


def request_for(
    schema_of: type[BaseModel],
    *,
    system: str,
    user: str,
    model: str | None = None,
    max_tokens: int = 4096,
) -> JSONRequest:
    """Build a request whose schema is derived from the model we want back."""
    return JSONRequest(
        system=system,
        user=user,
        schema=schema_of.model_json_schema(),
        schema_name=schema_of.__name__,
        model=model,
        max_tokens=max_tokens,
    )


def complete_model[M: BaseModel](
    provider: AIProvider, request: JSONRequest, into: type[M]
) -> StructuredResult[M]:
    attempt = request
    last_error: ValidationError | None = None
    for retried in (False, True):
        response = provider.complete_json(attempt)
        try:
            return StructuredResult(into.model_validate(response.data), response, retried)
        except ValidationError as error:
            last_error = error
            correction = _CORRECTION.format(errors=_faults(error))
            attempt = replace(request, user=request.user + correction)
    raise AIError(INVALID_RESPONSE, "AI answer did not match the schema") from last_error


def _faults(error: ValidationError, limit: int = 8) -> str:
    """Field paths and messages only.

    `include_input=False` matters for privacy: the rejected input is quoted back
    into the retry prompt otherwise, and it can hold CV or vacancy content.
    """
    reported = error.errors(include_url=False, include_input=False, include_context=False)
    faults = []
    for fault in reported[:limit]:
        location = ".".join(str(part) for part in fault["loc"]) or "(root)"
        faults.append(f"{location}: {fault['msg']}")
    return "; ".join(faults)
