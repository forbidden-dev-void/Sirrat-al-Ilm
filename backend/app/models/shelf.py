"""
Shelf + Resource models — the YouTube "shelves"
===============================================

A **Shelf** is a horizontally scrollable row on the home page (exactly like a
streaming-service shelf). A **Resource** is one clickable card inside a shelf.

Two shelves ship with seed content out of the box:

* ``wisdom``      -> religious + self-improvement YouTube references
* ``programming`` -> programming-language course playlists/videos

Clicking a card opens the YouTube page in a new tab and records progress for
the signed-in user (see ``ProgressEntry``).
"""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    pass


class ShelfKind(str, Enum):
    WISDOM = "wisdom"                # religion + self improvement
    PROGRAMMING = "programming"      # programming language courses
    TECH = "tech"                    # tech talks / tooling
    BOOKS = "books"                  # rendered from the Book table
    LIFE = "life"                    # life updates / vlogs


class Shelf(Base, TimestampMixin):
    __tablename__ = "shelves"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default=ShelfKind.WISDOM.value, index=True)
    subtitle: Mapped[Optional[str]] = mapped_column(String(240), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_image: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)
    accent: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # token name used by the UI
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    resources: Mapped[List["Resource"]] = relationship(
        back_populates="shelf",
        cascade="all, delete-orphan",
        order_by="Resource.sort_order",
        lazy="selectin",
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Shelf id={self.id} slug={self.slug!r} resources={len(self.resources)}>"


class Resource(Base, TimestampMixin):
    """One card inside a shelf — normally a YouTube video or playlist."""

    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    shelf_id: Mapped[int] = mapped_column(
        ForeignKey("shelves.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(220), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    resource_type: Mapped[str] = mapped_column(String(24), nullable=False, default="video")  # video|playlist|link

    # ``external_url`` is where the card redirects (YouTube watch/playlist URL).
    external_url: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)
    video_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)
    channel: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    duration_label: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # e.g. "42:10"
    lesson_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    level: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)            # beginner|intermediate|advanced
    language: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)         # Urdu | English | Arabic

    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    shelf: Mapped["Shelf"] = relationship(back_populates="resources", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Resource id={self.id} title={self.title!r}>"
