"""
SiteSetting model — editable "About" / site-wide copy
=====================================================

A tiny key/value table (value is JSON) that stores the long-form content the
owner edits from the admin panel: the About page (bio, education, experience,
skills), hero copy and social links. Keeping it in the database means the
admin can rewrite the landing page without a redeploy.
"""

from __future__ import annotations

from typing import Any, Dict

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class SiteSetting(Base, TimestampMixin):
    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<SiteSetting key={self.key!r}>"
