import asyncio

import typer
from sqlalchemy import text

from app.core.database import SessionLocal, init_database

app = typer.Typer(no_args_is_help=True, rich_markup_mode="rich")


@app.command("init")
def db_init():
    """Create all database tables."""
    typer.secho("Initializing database…", bold=True)

    try:
        asyncio.run(init_database())
    except Exception as e:
        typer.secho(f"Error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e

    typer.secho("✓ Database tables created", fg=typer.colors.GREEN)


@app.command("check")
def db_check():
    """Verify database connectivity."""
    typer.secho("Checking database connection…", bold=True)

    async def _check() -> str:
        await init_database()
        async with SessionLocal() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar_one()
            result = await session.execute(
                text("SELECT current_database()"),
            )
            db_name = result.scalar()
            return db_name

    try:
        db_name = asyncio.run(_check())
    except Exception as e:
        typer.secho(f"✗ Connection failed: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e

    typer.secho(f"✓ Connected to database: {db_name}", fg=typer.colors.GREEN)
