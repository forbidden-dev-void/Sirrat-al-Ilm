"""
Item model — the "Labs" listings
================================

The brief defines ``Item: id, owner_id (FK), title, description, image_url,
availability_status``. Sirrat al-Ilm uses Items for the **Labs** section: each
lab is a project/experiment card with an image gallery and a long description.

Extra fields (slug, kind, category, tags, gallery, sort_order) exist so the
front end can render shelves/detail pages without hard-coding content.
"""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, Any, List, Optional

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class AvailabilityStatus(str, Enum):
    """Lifecycle of a listing (kept as strings for portability)."""

    AVAILABLE = "available"
    IN_PROGRESS = "in_progress"
    ARCHIVED = "archived"
    DRAFT = "draft"


class Item(Base, TimestampMixin):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # --- Required by the brief -------------------------------------------
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_url: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)
    availability_status: Mapped[str] = mapped_column(
        String(24), nullable=False, default=AvailabilityStatus.AVAILABLE.value, index=True
    )

    # --- Presentation / navigation ---------------------------------------
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="lab", index=True)
    category: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(String(400), nullable=True)
    # ``gallery`` is a list of {"url": str, "caption": str} dicts rendered as
    # the image-gallery placeholder grid on the lab detail page.
    gallery: Mapped[List[Any]] = mapped_column(JSON, nullable=False, default=list)
    tags: Mapped[List[Any]] = mapped_column(JSON, nullable=False, default=list)
    external_url: Mapped[Optional[str]] = mapped_column(String(600), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    owner: Mapped["User"] = relationship(back_populates="items", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<Item id={self.id} slug={self.slug!r} status={self.availability_status!r}>"
