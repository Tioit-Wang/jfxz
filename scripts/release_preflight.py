from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REQUIRED_KEYS = (
    "NEXT_PUBLIC_API_BASE_URL",
    "NEXT_PUBLIC_ENABLE_TEST_PAYMENT",
    "GOODGUA_ENV",
    "GOODGUA_DATABASE_URL",
    "GOODGUA_JWT_SECRET",
    "GOODGUA_CORS_ORIGINS",
    "GOODGUA_BOOTSTRAP_ADMIN_EMAIL",
    "GOODGUA_BOOTSTRAP_ADMIN_PASSWORD",
)
PLACEHOLDER_MARKERS = (
    "your_",
    "replace-",
    "change-it",
    "example.com",
    "sk-your-api-key",
)


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def looks_like_placeholder(value: str) -> bool:
    lowered = value.lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def validate_env(values: dict[str, str]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    missing = [key for key in REQUIRED_KEYS if not values.get(key)]
    if missing:
        errors.append(f"missing required keys: {', '.join(missing)}")

    if values.get("GOODGUA_ENV") and values["GOODGUA_ENV"] != "production":
        errors.append("GOODGUA_ENV must be production for release")

    database_url = values.get("GOODGUA_DATABASE_URL", "")
    if database_url and not database_url.startswith("mysql+asyncmy://"):
        errors.append("GOODGUA_DATABASE_URL must use mysql+asyncmy://")

    jwt_secret = values.get("GOODGUA_JWT_SECRET", "")
    if jwt_secret and len(jwt_secret.encode("utf-8")) < 32:
        errors.append("GOODGUA_JWT_SECRET must be at least 32 bytes")
    if jwt_secret and looks_like_placeholder(jwt_secret):
        errors.append("GOODGUA_JWT_SECRET still looks like a placeholder")

    cors_origins = values.get("GOODGUA_CORS_ORIGINS", "")
    if "*" in cors_origins:
        errors.append("GOODGUA_CORS_ORIGINS cannot contain * in production")

    if values.get("NEXT_PUBLIC_ENABLE_TEST_PAYMENT", "").lower() != "false":
        errors.append("NEXT_PUBLIC_ENABLE_TEST_PAYMENT must be false in production")

    api_base_url = values.get("NEXT_PUBLIC_API_BASE_URL", "")
    if api_base_url and "localhost" in api_base_url:
        errors.append("NEXT_PUBLIC_API_BASE_URL cannot point to localhost for release")

    for key in ("GOODGUA_DATABASE_URL", "GOODGUA_BOOTSTRAP_ADMIN_EMAIL", "GOODGUA_BOOTSTRAP_ADMIN_PASSWORD"):
        value = values.get(key, "")
        if value and looks_like_placeholder(value):
            warnings.append(f"{key} still looks like a placeholder")

    return errors, warnings


def run_compose_check(repo_root: Path, env_file: Path) -> str | None:
    try:
        subprocess.run(
            ["docker", "compose", "--env-file", str(env_file), "config"],
            cwd=repo_root,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return "docker compose not found, skipped compose config validation"
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(exc.stderr.strip() or exc.stdout.strip() or "docker compose config failed") from exc
    return "docker compose config passed"


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate release env and docker compose readiness.")
    parser.add_argument(
        "--env-file",
        default=".env.production",
        help="Path to the production env file. Defaults to .env.production.",
    )
    parser.add_argument(
        "--skip-compose",
        action="store_true",
        help="Skip `docker compose config` validation.",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    env_file = (repo_root / args.env_file).resolve() if not Path(args.env_file).is_absolute() else Path(args.env_file)

    if not env_file.exists():
        print(f"[error] env file not found: {env_file}")
        return 1

    values = parse_env_file(env_file)
    errors, warnings = validate_env(values)

    compose_note: str | None = None
    if not args.skip_compose and not errors:
        try:
            compose_note = run_compose_check(repo_root, env_file)
        except RuntimeError as exc:
            errors.append(str(exc))

    for warning in warnings:
        print(f"[warn] {warning}")

    if errors:
        for error in errors:
            print(f"[error] {error}")
        return 1

    print(f"[ok] release env looks ready: {env_file}")
    if compose_note:
        print(f"[ok] {compose_note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
