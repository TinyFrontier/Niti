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
    ai_model: str = "google/gemini-2.5-flash"
    ai_timeout_seconds: float = 30.0
    # hard cap on characters sent to the model, per document
    ai_max_input_chars: int = 40_000


@lru_cache
def get_settings() -> Settings:
    return Settings()
