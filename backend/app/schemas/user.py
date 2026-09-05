"""User schemas — what the API is allowed to expose about a person."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserSummary(BaseModel):
    """Minimal public representation (author byline, admin people table)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    avatar_url: Optional[str] = None
    role: str = "user"


class UserOut(BaseModel):
    """Full profile for the signed-in user. ``password_hash`` is never exposed."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str = Field(max_length=120)
    role: str
    is_active: bool
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    occupation: Optional[str] = None
    location: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime


class AdminUserOut(UserOut):
    """Adds management metadata used by /admin/people."""

    items_count: int = 0
    progress_count: int = 0
