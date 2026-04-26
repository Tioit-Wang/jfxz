import os

os.environ.setdefault("JFXZ_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JFXZ_ENV", "test")
