"""
BlogPost model
==============

Powers the blog: religion, technology, life updates and programming-course
write-ups. ``body`` holds Markdown that the front end renders safely as text
(no ``dangerouslySetInnerHTML`` with un-sanitised markup).
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime

if TYPE_CHECKING:
    from app.models.user import User


class BlogPost(Base, TimestampMixin):
    __tablename__ = "blog_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(220), nullable=False)
    slug: Mapped[str] = mapped_column(String(240), unique=True, index=True, nullable=False)
    excerpt: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_image: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)

    category: Mapped[str] = mapped_column(String(48), nullable=False, default="life", index=True)
    tags: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reading_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    published_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime(), nullable=True)

    author: Mapped["User"] = relationship(back_populates="blog_posts", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<BlogPost id={self.id} slug={self.slug!r}>"
