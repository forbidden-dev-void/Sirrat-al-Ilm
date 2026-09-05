"""
Slug helpers
============

Slugs make URLs pretty *and* stable (``/labs/ai-study-circle``). The helpers
here guarantee uniqueness by appending ``-2``, ``-3``, ... when a slug is taken.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base

_SLUG_STRIP = re.compile(r"[^a-z0-9\s-]")
_WHITESPACE = re.compile(r"[\s_-]+")


def slugify(value: str, *, max_length: int = 180) -> str:
    """Convert any human title into a URL-safe slug.

    >>> slugify("Sirrat al-Ilm: Books & Blogs!")
    'sirrat-al-ilm-books-blogs'
    """
    if not value:
        return ""
    # Transliterate accented Latin characters (é -> e) before stripping.
    normalised = unicodedata.normalize("NFKD", value)
    normalised = normalised.encode("ascii", "ignore").decode("ascii")
    normalised = _SLUG_STRIP.sub("", normalised.lower())
    slug = _WHITESPACE.sub("-", normalised).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:max_length].rstrip("-") or "item"


def unique_slug(
    db: Session,
    model: type[Base],
    title: str,
    *,
    exclude_id: Optional[int] = None,
    fallback_prefix: str = "item",
) -> str:
    """Return a slug for ``title`` that is free inside ``model``'s table."""
    base = slugify(title) or fallback_prefix
    candidate = base
    suffix = 2
    while True:
        statement = select(model.id).where(model.slug == candidate)  # type: ignore[attr-defined]
        if exclude_id is not None:
            statement = statement.where(model.id != exclude_id)  # type: ignore[attr-defined]
        taken = db.execute(statement).first() is not None
        if not taken:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1
        if suffix > 500:  # pragma: no cover - defensive guard
            raise ValueError(f"Could not generate a unique slug for {title!r}")
