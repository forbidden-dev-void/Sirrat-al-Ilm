"""
Command line interface
======================

Run with ``python -m app.cli <command>`` from the ``backend`` directory (or via
the Makefile). These are the operational tasks that should never be done by
hand in a database shell:

    create-admin   create/repair the owner account (prompts for a password)
    promote        promote an existing account to admin
    demote         remove the admin role from an account
    users          list accounts
    seed           seed the demo library (idempotent)
    reset          DANGER: drop every table, recreate and re-seed
    run            start uvicorn with sensible defaults
"""

from __future__ import annotations

import argparse
import getpass
import logging
import sys
from typing import Optional

from sqlalchemy import func, select

from app.core.config import settings
from app.core.security import normalise_email
from app.db.session import create_all, drop_all, get_session_factory, init_engine
from app.models.user import User, UserRole
from app.services.seed import bootstrap_database, ensure_admin

logger = logging.getLogger("sirrat.cli")


def _ask_password(confirm: bool = True) -> str:
    """Read a password from the terminal without echoing it."""
    password = getpass.getpass("Password: ")
    if not password:
        print("Password must not be empty.", file=sys.stderr)
        raise SystemExit(2)
    if confirm:
        again = getpass.getpass("Repeat password: ")
        if password != again:
            print("Passwords do not match.", file=sys.stderr)
            raise SystemExit(2)
    return password


def _find_user(session, email: str) -> Optional[User]:
    return session.execute(
        select(User).where(func.lower(User.email) == normalise_email(email))
    ).scalar_one_or_none()


# --------------------------------------------------------------------------- #
# Commands                                                                     #
# --------------------------------------------------------------------------- #
def cmd_create_admin(args: argparse.Namespace) -> int:
    """Create the owner account, or reset the password of an existing one."""
    init_engine()
    create_all()
    session = get_session_factory()()
    try:
        email = normalise_email(args.email or settings.admin_email)
        password = args.password or _ask_password()
        user = _find_user(session, email)
        if user is None:
            user = User(email=email, full_name=args.name or settings.admin_full_name)
            session.add(user)
        user.role = UserRole.ADMIN.value
        user.is_active = True
        user.set_password(password)
        session.commit()
        print(f"Administrator ready: {email}")
        if email != normalise_email(settings.admin_email):
            print(
                "Note: ADMIN_EMAIL in your environment is "
                f"{settings.admin_email!r}. Set ADMIN_EMAIL={email} so this account "
                "keeps owner rights automatically."
            )
        return 0
    finally:
        session.close()


def cmd_promote(args: argparse.Namespace) -> int:
    init_engine()
    create_all()
    session = get_session_factory()()
    try:
        user = _find_user(session, args.email)
        if user is None:
            print(f"No account found for {args.email}", file=sys.stderr)
            return 1
        user.role = UserRole.ADMIN.value
        session.commit()
        print(f"{user.email} is now an administrator.")
        return 0
    finally:
        session.close()


def cmd_demote(args: argparse.Namespace) -> int:
    init_engine()
    create_all()
    session = get_session_factory()()
    try:
        user = _find_user(session, args.email)
        if user is None:
            print(f"No account found for {args.email}", file=sys.stderr)
            return 1
        if normalise_email(user.email) == normalise_email(settings.admin_email):
            print("Refusing to demote the configured owner account.", file=sys.stderr)
            return 2
        user.role = UserRole.USER.value
        session.commit()
        print(f"{user.email} is now a regular user.")
        return 0
    finally:
        session.close()


def cmd_users(_args: argparse.Namespace) -> int:
    init_engine()
    create_all()
    session = get_session_factory()()
    try:
        users = session.execute(select(User).order_by(User.id)).scalars().all()
        if not users:
            print("No accounts yet.")
            return 0
        print(f"{'ID':>4}  {'ROLE':<6}  {'ACTIVE':<6}  EMAIL / NAME")
        for user in users:
            print(
                f"{user.id:>4}  {user.role:<6}  {str(user.is_active):<6}  "
                f"{user.email}  ({user.full_name})"
            )
        return 0
    finally:
        session.close()


def cmd_seed(_args: argparse.Namespace) -> int:
    init_engine()
    create_all()
    session = get_session_factory()()
    try:
        summary = bootstrap_database(session, seed=True)
        print("Seed summary:", summary)
        return 0
    finally:
        session.close()


def cmd_reset(args: argparse.Namespace) -> int:
    """Drop + recreate every table. Refuses to run without confirmation."""
    if not args.yes:
        answer = input(
            f"This will DELETE all data in {settings.database_url}. Type 'yes' to continue: "
        )
        if answer.strip().lower() != "yes":
            print("Aborted.")
            return 1
    init_engine()
    drop_all()
    create_all()
    session = get_session_factory()()
    try:
        admin = ensure_admin(session)
        summary = bootstrap_database(session, seed=True)
        print("Database reset. Admin:", admin.email, "| summary:", summary)
        return 0
    finally:
        session.close()


def cmd_run(args: argparse.Namespace) -> int:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="debug" if settings.debug else "info",
    )
    return 0


# --------------------------------------------------------------------------- #
# Parser                                                                       #
# --------------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="app.cli", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create-admin", help="Create or repair the owner account")
    create.add_argument("--email", help=f"Defaults to ADMIN_EMAIL ({settings.admin_email})")
    create.add_argument("--name", help="Display name")
    create.add_argument("--password", help="Omit to be prompted securely (recommended)")
    create.set_defaults(func=cmd_create_admin)

    promote = sub.add_parser("promote", help="Promote an account to admin")
    promote.add_argument("email")
    promote.set_defaults(func=cmd_promote)

    demote = sub.add_parser("demote", help="Remove the admin role")
    demote.add_argument("email")
    demote.set_defaults(func=cmd_demote)

    users = sub.add_parser("users", help="List accounts")
    users.set_defaults(func=cmd_users)

    seed = sub.add_parser("seed", help="Seed the demo library (idempotent)")
    seed.set_defaults(func=cmd_seed)

    reset = sub.add_parser("reset", help="Drop, recreate and re-seed the database")
    reset.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    reset.set_defaults(func=cmd_reset)

    run = sub.add_parser("run", help="Start the API server")
    run.add_argument("--host", default="0.0.0.0")
    run.add_argument("--port", type=int, default=8000)
    run.add_argument("--reload", action="store_true")
    run.set_defaults(func=cmd_run)

    return parser


def main(argv: Optional[list[str]] = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)-7s | %(message)s")
    args = build_parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
