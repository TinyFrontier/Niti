"""Draft a career profile from the user's own materials.

Two sources feed the same call: the text of a CV and a free-form description the
user writes about themselves. They are complementary — a CV carries experience
and skills, while preferences and constraints (salary floor, relocation, domains
to avoid) usually exist only in the user's head.

The result is a proposal, never a saved fact: the caller returns it for the user
to confirm.
"""

from app.ai import prompt
from app.ai.provider import AIProvider
from app.ai.structured import complete_model, request_for
from app.career_profiles.schemas import CareerProfileData
from app.common.enums import ProfileFieldSource

SYSTEM = f"""You build a structured career profile from a candidate's own materials.

Return every key of the schema, and fill every one the documents support. Work
through all of them:
- target_roles: roles the candidate is aiming for, from their titles and stated goals
- seniority: from an explicit title, or from stated years of experience
- core_skills: technologies the candidate worked with; additional_skills: the rest
- total_experience_years, relevant_experience by area
- current_location, allowed_countries, allowed_timezones, work_formats, relocation
- salary: min_amount, currency, period
- languages with CEFR levels, work_authorization
- preferred_domains, avoided_domains, hard_constraints, notes

Rules:
- Use only what the documents state. Never invent experience, skills, salary, \
location or languages.
- Use null or an empty list only when the documents genuinely do not support a \
value. An unsupported field is correct; a guess is not.
- A skill counts as core only if the candidate worked with it, not if it is \
merely mentioned. Set a skill's years only when the documents state them.
- Map stated language ability to CEFR: "native" to native, "fluent" to c1, \
"conversational" to b1. Do not invent a level that is not stated.
- Answer with the JSON object only.

{prompt.UNTRUSTED_INPUT_RULE}"""

_INSTRUCTION = "Build the candidate's career profile from the documents below."


def draft(
    provider: AIProvider,
    *,
    cv_text: str | None = None,
    free_text: str | None = None,
    model: str | None = None,
) -> tuple[CareerProfileData, dict[str, ProfileFieldSource]]:
    """Return the proposed profile and where each filled field came from."""
    documents = []
    if cv_text:
        documents.append(prompt.as_document("cv", cv_text))
    if free_text:
        documents.append(prompt.as_document("about-me", free_text))
    if not documents:
        raise ValueError("draft needs a CV, a free-text description, or both")

    request = request_for(
        CareerProfileData,
        system=SYSTEM,
        user=f"{_INSTRUCTION}\n\n" + "\n\n".join(documents),
        model=model,
    )
    result = complete_model(provider, request, CareerProfileData)
    return result.value, field_sources(result.value, cv_text=cv_text, free_text=free_text)


def field_sources(
    data: CareerProfileData, *, cv_text: str | None, free_text: str | None
) -> dict[str, ProfileFieldSource]:
    """Label every field the model actually filled.

    One call sees both documents at once, so per-field provenance is only
    recoverable when a single source was sent. With both, the label degrades to
    a plain "ai" — enough for the UI, which only needs to know a value is a
    proposal awaiting confirmation.
    """
    if cv_text and free_text:
        origin = ProfileFieldSource.AI
    elif cv_text:
        origin = ProfileFieldSource.CV_AI
    else:
        origin = ProfileFieldSource.TEXT_AI

    # every field defaults to None or an empty list, so "filled" is just "not empty"
    return {
        name: origin
        for name, value in data.model_dump().items()
        if value not in (None, [], {}, "")
    }
