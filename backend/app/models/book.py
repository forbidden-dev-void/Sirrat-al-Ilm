"""
Book model — "Books written by me, free for everyone"
=====================================================

Books are downloadable/readable artefacts owned by the site author. The
``file_url`` points at a PDF (local ``/media/books/...`` or an external link);
``pages`` + ``language`` feed the reader UI, and ``download_count`` is bumped by
the API so the admin dashboard can show real engagement numbers.
"""

from __future__ import annotations

from datetime import date
from typing import List, Optional

from sqlalchemy import JSON, Boolean, Date, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Book(Base, TimestampMixin):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(220), nullable=False)
    slug: Mapped[str] = mapped_column(String(240), unique=True, index=True, nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String(260), nullable=True)
    author: Mapped[str] = mapped_column(String(160), nullable=False, default="Rehan Rae Essayyed")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_url: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)

    category: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    tags: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    language: Mapped[str] = mapped_column(String(32), nullable=False, default="English")
    pages: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    edition: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    published_on: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    is_free: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    download_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Table of contents rendered on the book detail page: [{"chapter": str, "title": str}]
    table_of_contents: Mapped[List[dict]] = mapped_column(JSON, nullable=False, default=list)

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Book id={self.id} slug={self.slug!r}>"
