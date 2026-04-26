from functools import lru_cache
from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
SHARED_ENV_FILES = (REPO_ROOT / ".env", REPO_ROOT / ".env.local")


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres"
    jwt_secret: str = "dev-secret"
    auto_create_tables: bool = True
    env: str = "development"
    cors_origins: str = "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3100,http://localhost:3100"
    user_session_seconds: int = 60 * 60 * 24
    admin_session_seconds: int = 60 * 60 * 2
    enable_payment_simulator: bool = False
    trusted_proxy_ips: str = ""
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"

    model_config = SettingsConfigDict(env_prefix="JFXZ_", env_file=SHARED_ENV_FILES, extra="ignore")

    @field_validator("env")
    @classmethod
    def normalize_env(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in {"development", "test", "production"}:
            raise ValueError("JFXZ_ENV must be development, test, or production")
        return normalized

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def trusted_proxy_ip_set(self) -> set[str]:
        return {ip.strip() for ip in self.trusted_proxy_ips.split(",") if ip.strip()}

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        if self.is_production:
            self.enable_payment_simulator = False
            if self.jwt_secret == "dev-secret" or len(self.jwt_secret.encode("utf-8")) < 32:
                raise ValueError("JFXZ_JWT_SECRET must be at least 32 bytes in production")
            if "*" in self.cors_origin_list:
                raise ValueError("JFXZ_CORS_ORIGINS cannot contain * in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
