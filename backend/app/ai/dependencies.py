"""FastAPI wiring for the AI provider.

Routers depend on the protocol, so tests swap in `MockAIProvider` through
`dependency_overrides` exactly like they swap the database session.
"""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.ai.openrouter import OpenRouterProvider
from app.ai.provider import AIProvider


@lru_cache
def _provider() -> AIProvider:
    return OpenRouterProvider()


def get_ai_provider() -> AIProvider:
    return _provider()


AIProviderDep = Annotated[AIProvider, Depends(get_ai_provider)]
