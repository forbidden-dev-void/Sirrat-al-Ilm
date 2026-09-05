"""
Declarative base + shared model mixins
======================================

Everything that is repeated across tables lives here so the models stay small
and consistent (UTC timestamps, ordering, string representation).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, MetaData
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Deterministic constraint names make migrations (Alembic) diff-friendly.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utcnow() -> datetime:
    """Timezone-aware "now" used by every default timestamp."""
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """
    Timezone-safe DateTime.

    SQLite stores naive datetimes while PostgreSQL stores offsets. This
    decorator normalises both directions to timezone-aware UTC so API responses
    always carry an explicit offset and comparisons never mix naive/aware
    datetimes (a classic source of "can't compare offset-naive" crashes).
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):  # noqa: ANN001 - SQLAlchemy hook
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        if value is not None:
            return value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value, dialect):  # noqa: ANN001 - SQLAlchemy hook
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    """Adds ``created_at`` / ``updated_at`` maintained by the ORM."""

    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, onupdate=utcnow, nullable=False
    )
