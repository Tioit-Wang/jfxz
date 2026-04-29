import typer

from app.cli.db import app as db_app
from app.cli.user import app as user_app

cli = typer.Typer(no_args_is_help=True, rich_markup_mode="rich")
cli.add_typer(user_app, name="user", help="User management operations")
cli.add_typer(db_app, name="db", help="Database operations")
