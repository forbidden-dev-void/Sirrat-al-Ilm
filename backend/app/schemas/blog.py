"""Blog post schemas (religion / tech / life updates / programming)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserSummary

BLOG_CATEGORIES = ("religion", "tech", "life", "programming", "books")


class BlogPostBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=2, max_length=220)
    slug: Optional[str] = Field(default=None, max_length=240)
    excerpt: str = Field(default="", max_length=500)
    body: str = Field(default="", max_length=100000)
    cover_image: Optional[str] = Field(default=None, max_length=600)
    category: str = Field(default="life", pattern="^(religion|tech|life|programming|books)$")
    tags: List[str] = Field(default_factory=list)
    is_published: bool = True
    is_featured: bool = False
    reading_minutes: int = Field(default=4, ge=1, le=300)


class BlogPostCreate(BlogPostBase):
    pass


class BlogPostUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=2, max_length=220)
    slug: Optional[str] = Field(default=None, max_length=240)
    excerpt: Optional[str] = Field(default=None, max_length=500)
    body: Optional[str] = Field(default=None, max_length=100000)
    cover_image: Optional[str] = Field(default=None, max_length=600)
    category: Optional[str] = Field(default=None, pattern="^(religion|tech|life|programming|books)$")
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    reading_minutes: Optional[int] = Field(default=None, ge=1, le=300)


class BlogPostSummary(BaseModel):
    """List view — deliberately omits ``body`` to keep payloads small."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    excerpt: str
    cover_image: Optional[str] = None
    category: str
    tags: List[str] = Field(default_factory=list)
    reading_minutes: int
    view_count: int = 0
    is_published: bool
    is_featured: bool
    published_at: Optional[datetime] = None
    author: Optional[UserSummary] = None


class BlogPostOut(BlogPostSummary):
    body: str
