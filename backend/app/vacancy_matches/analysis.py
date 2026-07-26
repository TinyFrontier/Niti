"""Compare one vacancy against one candidate's confirmed materials.

The model's whole job is evidence: which requirements the vacancy states, whether
the candidate's documents back each one, and the fragments that show it. Scoring
happens afterwards, in `scoring`, from that evidence alone.
"""

import hashlib
import json

from app.ai import prompt
from app.ai.provider import AIProvider
from app.ai.structured import complete_model, request_for
from app.career_profiles.schemas import CareerProfileData
from app.cv_versions.models import CVVersion
from app.vacancies.models import Vacancy
from app.vacancy_matches.schemas import MatchEvidence
from app.vacancy_matches.scoring import SCORING_VERSION

PROMPT_VERSION = "1.0"

# Below this a description carries no requirements worth comparing against.
MIN_DESCRIPTION_LENGTH = 200

SYSTEM = f"""You compare a job vacancy against a candidate's own materials.

Produce evidence, not opinions. For every requirement the vacancy states:
- restate the requirement, quote the fragment of the vacancy it comes from, and \
place it in one category: skills, experience, location, compensation or domain;
- mark it required when the vacancy presents it as a condition, preferred when it \
is a nice-to-have;
- set status to met or partial only when the CV or the profile backs it, and put \
that backing in evidence with its source;
- set status to missing when the materials show the candidate does not have it;
- set status to unknown when the vacancy is too vague to judge.

Rules:
- Never invent experience, skills or preferences. Absence of proof is missing or \
unknown, never a match.
- A hard blocker is only for a stated condition the candidate demonstrably fails: \
a required language they do not speak, on-site work in a location they excluded, \
work authorization they lack, pay below their stated minimum, a required stack \
they have none of, or relocation they ruled out.
- red_flags are warning signs in how the vacancy is written; unknowns are facts \
the vacancy leaves out.
- Do not output a score or a recommendation. That is computed from your evidence.

{prompt.UNTRUSTED_INPUT_RULE}"""


def build_user_prompt(
    vacancy: Vacancy, cv_text: str | None, profile: CareerProfileData
) -> str:
    facts = json.dumps(
        profile.model_dump(mode="json", exclude_none=True), ensure_ascii=False, indent=1
    )
    blocks = [
        prompt.as_document("vacancy", _vacancy_text(vacancy)),
        prompt.as_document("candidate-profile", facts),
    ]
    if cv_text:
        blocks.append(prompt.as_document("candidate-cv", cv_text))
    return (
        "Compare the vacancy with the candidate's materials below and report the "
        "evidence.\n\n" + "\n\n".join(blocks)
    )


def analyze(
    provider: AIProvider,
    *,
    vacancy: Vacancy,
    cv_text: str | None,
    profile: CareerProfileData,
    model: str | None = None,
) -> MatchEvidence:
    request = request_for(
        MatchEvidence,
        system=SYSTEM,
        user=build_user_prompt(vacancy, cv_text, profile),
        model=model,
        # evidence for a dozen requirements is far longer than a profile draft
        max_tokens=8000,
    )
    return complete_model(provider, request, MatchEvidence).value


def input_hash(
    vacancy: Vacancy, cv: CVVersion | None, profile_revision: int, model: str
) -> str:
    """Identifies everything a result depends on.

    Includes the prompt and scoring versions: changing either makes previous
    results stale even though the user's data did not move.
    """
    payload = json.dumps(
        {
            "vacancy": _vacancy_text(vacancy),
            "cv": cv.content_hash if cv else None,
            "profile_revision": profile_revision,
            "model": model,
            "prompt_version": PROMPT_VERSION,
            "scoring_version": SCORING_VERSION,
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _vacancy_text(vacancy: Vacancy) -> str:
    """Everything about the vacancy that can change a verdict, in a stable order.

    Empty structured fields are omitted rather than rendered as "not stated".
    Importers fill these only sometimes, so a placeholder would contradict a
    description that states the salary or the office outright — and the model
    believes the header, reporting a fact as missing instead of judging it.
    """
    known = {
        "Title": vacancy.title,
        "Company": vacancy.company.name if vacancy.company else None,
        "Location": vacancy.location,
        "Work format": _known(vacancy.work_format.value),
        "Job type": _known(vacancy.job_type.value),
        "Salary": vacancy.salary,
    }
    header = [f"{label}: {value}" for label, value in known.items() if value]
    return "\n".join([*header, "", vacancy.description or ""])


def _known(value: str) -> str | None:
    return None if value == "unknown" else value


def has_usable_description(vacancy: Vacancy) -> bool:
    return len((vacancy.description or "").strip()) >= MIN_DESCRIPTION_LENGTH
