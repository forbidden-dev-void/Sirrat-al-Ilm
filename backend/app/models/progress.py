"""
ProgressEntry model — "track what I watched / read"
===================================================

One row per (user, resource). This is what powers the **user dashboard**:

* "Continue watching" / "Continue reading" rows
* Completion percentage rings + streak style statistics
* A personal notes field so learners can keep reflections next to a video

The row stores a *snapshot* of the resource (title + ``meta``) so the dashboard
renders even if the underlying video/book is later unpublished by the admin.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import JSON, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime, utcnow

if TYPE_CHECKING:
    from app.models.user import User


class ResourceType(str, Enum):
    VIDEO = "video"
    BOOK = "book"
    BLOG = "blog"
    LAB = "lab"


class ProgressStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ProgressEntry(Base, TimestampMixin):
    __tablename__ = "progress_entries"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "resource_type", "resource_id", name="uq_progress_user_resource"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    resource_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    resource_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # --- Denormalised snapshot (survives unpublishing / renaming) ----------
    resource_title: Mapped[str] = mapped_column(String(220), nullable=False, default="")
    resource_slug: Mapped[Optional[str]] = mapped_column(String(240), nullable=True)
    meta: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # --- Learning state ----------------------------------------------------
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ProgressStatus.NOT_STARTED.value, index=True
    )
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    last_accessed_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), nullable=False, default=utcnow
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime(), nullable=True)

    user: Mapped["User"] = relationship(back_populates="progress_entries", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return (
            f"<ProgressEntry user={self.user_id} {self.resource_type}:{self.resource_id} "
            f"{self.status} {self.progress_percent}%>"
        )
