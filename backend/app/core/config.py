from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://jobsearch:jobsearch@localhost:5432/jobsearch"
    secret_key: str = "dev-secret-change-me"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
    upload_dir: str = "uploads"

    google_client_id: str = ""
    google_client_secret: str = ""
    api_base_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"
    cookie_domain: str | None = None
    cookie_secure: bool = False
    session_expire_days: int = 30
    debug: bool = True

    # AI provider (OpenRouter): one OpenAI-compatible endpoint, model picked by slug
    # so it can be swapped without code changes.
    open_router_api_key: str = ""
    ai_base_url: str = "https://openrouter.ai/api/v1"
    # Picked on measured behaviour, not price: the western cheap models all invent
    # per-skill durations a CV never states, and an invented "7 years of Python"
    # that the user rubber-stamps becomes a fact the job matching then trusts.
    ai_model: str = "bytedance-seed/seed-1.6-flash"
    # Matching is measured separately, and the answer differs: demanding a quote
    # and a piece of evidence per finding constrains the model far more than
    # profile extraction does, so the cheaper, faster model matches seed's
    # accuracy here while it invented skill durations there. Empty falls back to
    # ai_model.
    ai_model_match: str = "google/gemini-2.5-flash-lite"
    # ~17s is this model's typical answer, and a corrective retry doubles it
    ai_timeout_seconds: float = 60.0
    # lets a deployment run the queue worker as a separate process instead
    match_worker_enabled: bool = True
    # hard cap on characters sent to the model, per document
    ai_max_input_chars: int = 40_000

    def match_model(self) -> str:
        return self.ai_model_match or self.ai_model


@lru_cache
def get_settings() -> Settings:
    return Settings()
