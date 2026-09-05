"""
Database engine & session management
====================================

A single module owns the SQLAlchemy engine so that:

* the web app, the CLI and the test-suite all talk to the same factory;
* tests can swap in an isolated database through :func:`init_engine`;
* SQLite gets sane defaults (thread-safe sessions, enforced foreign keys).
"""

from __future__ import annotations

from typing import Iterator, Optional

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.base import Base

_engine: Optional[Engine] = None
_session_factory: Optional[sessionmaker[Session]] = None


def _build_engine(url: str, *, echo: bool = False, **kwargs) -> Engine:
    """Create an engine with the right options for SQLite or PostgreSQL."""
    connect_args = kwargs.pop("connect_args", {})
    if url.startswith("sqlite"):
        # FastAPI runs sync sessions in a threadpool -> allow cross-thread use.
        connect_args.setdefault("check_same_thread", False)
        engine = create_engine(url, echo=echo, future=True, connect_args=connect_args, **kwargs)

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection, _connection_record):  # pragma: no cover - driver hook
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")   # SQLite ignores FKs by default
            cursor.execute("PRAGMA journal_mode=WAL")   # concurrent readers + one writer
            cursor.close()

        return engine

    # PostgreSQL / MySQL: pool tuning + reconnect on dropped connections.
    return create_engine(
        url,
        echo=echo,
        future=True,
        pool_pre_ping=True,
        pool_size=kwargs.pop("pool_size", 10),
        max_overflow=kwargs.pop("max_overflow", 20),
        **kwargs,
    )


def init_engine(url: Optional[str] = None, *, echo: Optional[bool] = None, **kwargs) -> Engine:
    """(Re)create the global engine — used at startup and by the test-suite."""
    global _engine, _session_factory
    dispose_engine()
    _engine = _build_engine(
        url or settings.resolved_database_url(),
        echo=settings.database_echo if echo is None else echo,
        **kwargs,
    )
    _session_factory = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False, future=True)
    return _engine


def get_engine() -> Engine:
    if _engine is None:
        init_engine()
    assert _engine is not None  # for type-checkers
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    if _session_factory is None:
        init_engine()
    assert _session_factory is not None  # for type-checkers
    return _session_factory


def dispose_engine() -> None:
    """Drop the current engine/session factory (test isolation & graceful shutdown)."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None


def create_all() -> None:
    """Create every table registered on the declarative base."""
    import app.models  # noqa: F401  (ensures all models are imported/registered)

    Base.metadata.create_all(bind=get_engine())


def drop_all() -> None:
    import app.models  # noqa: F401

    Base.metadata.drop_all(bind=get_engine())


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a scoped session that always closes."""
    session = get_session_factory()()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
