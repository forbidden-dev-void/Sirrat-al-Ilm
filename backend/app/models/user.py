"""
User model
==========

Matches the schema requested in the brief (``id, email, password_hash,
full_name, created_at``) and adds what a real product needs:

* ``role``           -> "admin" (owner only) or "user"
* ``is_active``      -> soft-disable an account without deleting its history
* ``bio``/``avatar`` -> profile settings editable from the user dashboard
* ``last_login_at``  -> shown in the admin "People" table
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UTCDateTime

if TYPE_CHECKING:  # avoids circular imports at runtime
    from app.models.blog import BlogPost
    from app.models.item import Item
    from app.models.progress import ProgressEntry


class UserRole(str, Enum):
    """Roles are stored as plain strings so new ones never need a DB migration."""

    ADMIN = "admin"
    USER = "user"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)

    role: Mapped[str] = mapped_column(
        String(16), nullable=False, default=UserRole.USER.value, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # --- Optional profile fields (user dashboard -> Settings) -------------
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    occupation: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    last_login_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime(), nullable=True)

    # --- Relationships ----------------------------------------------------
    items: Mapped[List["Item"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", lazy="selectin"
    )
    blog_posts: Mapped[List["BlogPost"]] = relationship(
        back_populates="author", cascade="all, delete-orphan", lazy="selectin"
    )
    progress_entries: Mapped[List["ProgressEntry"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )

    # --- Convenience ------------------------------------------------------
    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN.value

    def set_password(self, plain_password: str) -> None:
        """Hash + store a new password (see app.core.security)."""
        from app.core.security import hash_password

        self.password_hash = hash_password(plain_password)

    def verify_password(self, plain_password: str) -> bool:
        from app.core.security import verify_password

        return verify_password(plain_password, self.password_hash)

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"<User id={self.id} email={self.email!r} role={self.role!r}>"
