import os

os.environ.setdefault("JFXZ_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JFXZ_ENV", "test")
os.environ.setdefault("JFXZ_ENABLE_PAYMENT_SIMULATOR", "true")
