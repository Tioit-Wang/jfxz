import pytest

from app.core.config import Settings


class TestSettingsDatabaseRouting:
    def test_development_defaults_to_sqlite(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("GOODGUA_DATABASE_URL", raising=False)
        settings = Settings(env="development", jwt_secret="x" * 32, _env_file=None)
        assert settings.database_url == "sqlite+aiosqlite:///./goodgua-dev.db"

    def test_test_defaults_to_sqlite_memory(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("GOODGUA_DATABASE_URL", raising=False)
        settings = Settings(env="test", jwt_secret="x" * 32, _env_file=None)
        assert settings.database_url == "sqlite+aiosqlite:///:memory:"

    def test_production_requires_database_url(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("GOODGUA_DATABASE_URL", raising=False)
        with pytest.raises(ValueError, match="GOODGUA_DATABASE_URL is required in production"):
            Settings(
                env="production",
                jwt_secret="x" * 32,
                cors_origins="https://goodgua.net",
                _env_file=None,
            )

    def test_production_requires_mysql_asyncmy(self) -> None:
        with pytest.raises(ValueError, match="must use mysql\\+asyncmy in production"):
            Settings(
                env="production",
                database_url="sqlite+aiosqlite:///./prod.db",
                jwt_secret="x" * 32,
                cors_origins="https://goodgua.net",
                _env_file=None,
            )

    def test_development_rejects_non_sqlite(self) -> None:
        with pytest.raises(ValueError, match="must use sqlite\\+aiosqlite in development/test"):
            Settings(
                env="development",
                database_url="mysql+asyncmy://user:pass@127.0.0.1:3306/goodgua",
                _env_file=None,
            )
