import asyncio
import secrets

import typer
from pydantic import EmailStr, TypeAdapter
from rich.console import Console
from rich.table import Table
from sqlalchemy import select

from app.core.database import SessionLocal, init_database
from app.core.security import hash_password
from app.models import PointAccount, User

app = typer.Typer(no_args_is_help=True, rich_markup_mode="rich")
EMAIL_ADAPTER = TypeAdapter(EmailStr)
PASSWORD_BYTES = 24
_console = Console()


# ── helpers ────────────────────────────────────────────────


def _generate_password() -> str:
    return secrets.token_urlsafe(PASSWORD_BYTES)


def _normalize_email(email: str) -> str:
    return str(EMAIL_ADAPTER.validate_python(email)).lower()


async def _fetch_user(session, identifier: str) -> User | None:
    row = await session.execute(select(User).where(User.id == identifier))
    user = row.scalar_one_or_none()
    if user is None:
        row = await session.execute(select(User).where(User.email == identifier))
        user = row.scalar_one_or_none()
    return user


# ── async operations ───────────────────────────────────────


async def _create_user(
    email: str,
    nickname: str | None,
    role: str,
    password: str | None,
) -> tuple[User, str]:
    normalized_email = _normalize_email(email)
    await init_database()
    async with SessionLocal() as session:
        existing = await session.execute(
            select(User).where(User.email == normalized_email),
        )
        if existing.scalar_one_or_none() is not None:
            raise typer.BadParameter(f"Email already exists: {normalized_email}")

        pw = password or _generate_password()
        user = User(
            email=normalized_email,
            nickname=nickname or normalized_email.split("@")[0],
            role=role,
            password_hash=hash_password(pw),
            last_login_at=None,
        )
        session.add(user)
        await session.flush()
        session.add(
            PointAccount(
                user_id=user.id,
                vip_daily_points_balance=0,
                credit_pack_points_balance=0,
            )
        )
        await session.commit()
        return user, pw


async def _list_users(role: str | None, status: str | None) -> list[User]:
    await init_database()
    async with SessionLocal() as session:
        query = select(User)
        if role:
            query = query.where(User.role == role)
        if status:
            query = query.where(User.status == status)
        query = query.order_by(User.created_at.desc())
        rows = await session.execute(query)
        return list(rows.scalars().all())


async def _get_user(identifier: str) -> User | None:
    await init_database()
    async with SessionLocal() as session:
        return await _fetch_user(session, identifier)


async def _set_user_status(identifier: str, new_status: str) -> tuple[User, str]:
    await init_database()
    async with SessionLocal() as session:
        user = await _fetch_user(session, identifier)
        if user is None:
            raise typer.BadParameter(f"User not found: {identifier}")
        old_status = user.status
        user.status = new_status
        await session.commit()
        return user, old_status


async def _reset_password(
    identifier: str, password: str | None
) -> tuple[User, str]:
    await init_database()
    async with SessionLocal() as session:
        user = await _fetch_user(session, identifier)
        if user is None:
            raise typer.BadParameter(f"User not found: {identifier}")
        pw = password or _generate_password()
        user.password_hash = hash_password(pw)
        await session.commit()
        return user, pw


# ── CLI commands ───────────────────────────────────────────


@app.command("create-admin")
def create_admin(
    email: str = typer.Argument(..., help="Admin email address"),
    password: str = typer.Option(
        None, "--password", "-p", help="Custom password (auto-generated if omitted)",
    ),
):
    """Create an administrator account."""
    try:
        _normalize_email(email)
    except Exception as e:
        raise typer.BadParameter(f"Invalid email: {e}") from e

    try:
        user, pw = asyncio.run(_create_user(email, None, "admin", password))
    except typer.BadParameter:
        raise
    except Exception as e:
        typer.secho(f"Error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e

    typer.secho("✓ Admin account created", fg=typer.colors.GREEN, bold=True)
    print(f"  Email:    {user.email}")
    if password:
        print("  Password: [custom]")
    else:
        typer.secho(f"  Password: {pw}", fg=typer.colors.YELLOW, bold=True)
        print("  Store this password now. It will not be shown again.")


@app.command("create")
def create_user(
    email: str = typer.Argument(..., help="User email address"),
    nickname: str = typer.Option(
        None, "--nickname", "-n", help="Display name (defaults to email username)",
    ),
    password: str = typer.Option(
        None, "--password", "-p", help="Custom password (auto-generated if omitted)",
    ),
):
    """Create a regular user account."""
    try:
        _normalize_email(email)
    except Exception as e:
        raise typer.BadParameter(f"Invalid email: {e}") from e

    try:
        user, pw = asyncio.run(_create_user(email, nickname, "user", password))
    except typer.BadParameter:
        raise
    except Exception as e:
        typer.secho(f"Error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e

    typer.secho("✓ User account created", fg=typer.colors.GREEN, bold=True)
    print(f"  Email:    {user.email}")
    print(f"  Nickname: {user.nickname}")
    if password:
        print("  Password: [custom]")
    else:
        typer.secho(f"  Password: {pw}", fg=typer.colors.YELLOW, bold=True)
        print("  Store this password now. It will not be shown again.")


@app.command("list")
def list_users(
    role: str | None = typer.Option(
        None, "--role", "-r", help="Filter by role (admin / user)",
    ),
    status: str | None = typer.Option(
        None, "--status", "-s", help="Filter by status (active / suspended)",
    ),
):
    """List all user accounts."""
    users = asyncio.run(_list_users(role, status))

    if not users:
        typer.secho("No users found.", fg=typer.colors.YELLOW)
        raise typer.Exit()

    table = Table(highlight=True)
    table.add_column("ID", style="dim")
    table.add_column("Email")
    table.add_column("Nickname")
    table.add_column("Role")
    table.add_column("Status")
    table.add_column("Created")

    for u in users:
        created = u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "-"
        table.add_row(u.id, u.email, u.nickname, u.role, u.status, created)

    _console.print(table)
    typer.secho(f"Total: {len(users)} user(s)", bold=True)


@app.command("get")
def get_user(
    identifier: str = typer.Argument(..., help="User ID or email"),
):
    """Show detailed information for a user."""
    user = asyncio.run(_get_user(identifier))

    if user is None:
        typer.secho(f"User not found: {identifier}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)

    typer.secho("User Details:", bold=True)
    print(f"  ID:           {user.id}")
    print(f"  Email:        {user.email}")
    print(f"  Nickname:     {user.nickname}")
    print(f"  Role:         {user.role}")
    print(f"  Status:       {user.status}")
    print(
        "  Created At:   "
        + (user.created_at.strftime("%Y-%m-%d %H:%M:%S %Z") if user.created_at else "-")
    )
    print(
        "  Updated At:   "
        + (user.updated_at.strftime("%Y-%m-%d %H:%M:%S %Z") if user.updated_at else "-")
    )
    print(
        "  Last Login:   "
        + (
            user.last_login_at.strftime("%Y-%m-%d %H:%M:%S %Z")
            if user.last_login_at
            else "Never"
        )
    )


@app.command("set-status")
def set_user_status(
    identifier: str = typer.Argument(..., help="User ID or email"),
    status: str = typer.Argument(..., help="New status (active / suspended)"),
):
    """Activate or suspend a user account."""
    if status not in ("active", "suspended"):
        raise typer.BadParameter("Status must be 'active' or 'suspended'")

    try:
        user, old_status = asyncio.run(_set_user_status(identifier, status))
    except typer.BadParameter:
        raise
    except Exception as e:
        typer.secho(f"Error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e

    typer.secho(
        f"✓ Status updated: {old_status} → {status}", fg=typer.colors.GREEN,
    )
    print(f"  Email: {user.email}")


@app.command("reset-password")
def reset_password(
    identifier: str = typer.Argument(..., help="User ID or email"),
    password: str = typer.Option(
        None, "--password", "-p", help="New password (auto-generated if omitted)",
    ),
):
    """Reset a user's password."""
    try:
        user, pw = asyncio.run(_reset_password(identifier, password))
    except typer.BadParameter:
        raise
    except Exception as e:
        typer.secho(f"Error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e

    typer.secho(f"✓ Password reset for {user.email}", fg=typer.colors.GREEN, bold=True)
    if password:
        print("  Password: [custom]")
    else:
        typer.secho(f"  New password: {pw}", fg=typer.colors.YELLOW, bold=True)
        print("  Store this password now. It will not be shown again.")
