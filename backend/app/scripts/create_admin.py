import argparse
import asyncio
import secrets
import sys
from pathlib import Path

sys.path[:0] = [str(Path(__file__).resolve().parents[2])]

from pydantic import EmailStr, TypeAdapter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal, init_database
from app.core.security import hash_password
from app.models import PointAccount, User

EMAIL_ADAPTER = TypeAdapter(EmailStr)
PASSWORD_BYTES = 24


class AdminEmailExistsError(ValueError):
    pass


def generate_admin_password() -> str:
    return secrets.token_urlsafe(PASSWORD_BYTES)


def normalize_email(email: str) -> str:
    return str(EMAIL_ADAPTER.validate_python(email)).lower()


async def create_admin_account(session: AsyncSession, email: str) -> tuple[User, str]:
    normalized_email = normalize_email(email)
    existing = await session.execute(select(User).where(User.email == normalized_email))
    if existing.scalar_one_or_none() is not None:
        raise AdminEmailExistsError(f"email already exists: {normalized_email}")

    password = generate_admin_password()
    user = User(
        email=normalized_email,
        nickname=normalized_email.split("@")[0],
        role="admin",
        password_hash=hash_password(password),
        last_login_at=None,
    )
    session.add(user)
    await session.flush()
    session.add(
        PointAccount(user_id=user.id, vip_daily_points_balance=0, credit_pack_points_balance=0)
    )
    await session.flush()
    return user, password


async def async_main(email: str) -> tuple[User, str]:
    await init_database()
    async with SessionLocal() as session:
        user, password = await create_admin_account(session, email)
        await session.commit()
        return user, password


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create an admin account with a generated password."
    )
    parser.add_argument("email", nargs="?", help="Admin email address")
    parser.add_argument("--email", dest="email_option", help="Admin email address")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.email and args.email_option:
        parser.error("email can be provided either positionally or with --email, not both")
    email = args.email_option or args.email
    if email is None:
        parser.error("email is required")

    try:
        user, password = asyncio.run(async_main(email))
    except AdminEmailExistsError as exc:
        raise SystemExit(str(exc)) from exc

    print("Admin account created")
    print(f"Email: {user.email}")
    print(f"Password: {password}")
    print("Store this password now. It will not be shown again.")


if __name__ == "__main__":
    main()
