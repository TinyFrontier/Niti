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


@lru_cache
def get_settings() -> Settings:
    return Settings()
