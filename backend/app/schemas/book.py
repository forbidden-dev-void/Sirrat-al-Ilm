"""Book schemas (free books written by the site owner)."""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class TocEntry(BaseModel):
    """Table-of-contents row shown on the book detail page."""

    model_config = ConfigDict(extra="forbid")

    chapter: str = Field(max_length=24)
    title: str = Field(max_length=180)
    pages: Optional[str] = Field(default=None, max_length=24)


class BookBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=220)
    slug: Optional[str] = Field(default=None, max_length=240)
    subtitle: Optional[str] = Field(default=None, max_length=260)
    author: str = Field(default="Rehan Rae Essayyed", max_length=160)
    description: str = Field(default="", max_length=20000)
    cover_url: Optional[str] = Field(default=None, max_length=600)
    file_url: Optional[str] = Field(default=None, max_length=600)
    category: Optional[str] = Field(default=None, max_length=80)
    tags: List[str] = Field(default_factory=list)
    language: str = Field(default="English", max_length=32)
    pages: Optional[int] = Field(default=None, ge=1, le=100000)
    edition: Optional[str] = Field(default=None, max_length=40)
    published_on: Optional[date] = None
    is_free: bool = True
    is_published: bool = True
    is_featured: bool = False
    sort_order: int = 0
    table_of_contents: List[TocEntry] = Field(default_factory=list)


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    """Partial update used by the admin book manager."""

    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1, max_length=220)
    slug: Optional[str] = Field(default=None, max_length=240)
    subtitle: Optional[str] = Field(default=None, max_length=260)
    author: Optional[str] = Field(default=None, max_length=160)
    description: Optional[str] = Field(default=None, max_length=20000)
    cover_url: Optional[str] = Field(default=None, max_length=600)
    file_url: Optional[str] = Field(default=None, max_length=600)
    category: Optional[str] = Field(default=None, max_length=80)
    tags: Optional[List[str]] = None
    language: Optional[str] = Field(default=None, max_length=32)
    pages: Optional[int] = Field(default=None, ge=1, le=100000)
    edition: Optional[str] = Field(default=None, max_length=40)
    published_on: Optional[date] = None
    is_free: Optional[bool] = None
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None
    table_of_contents: Optional[List[TocEntry]] = None


class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    subtitle: Optional[str] = None
    author: str
    description: str
    cover_url: Optional[str] = None
    file_url: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    language: str
    pages: Optional[int] = None
    edition: Optional[str] = None
    published_on: Optional[date] = None
    is_free: bool
    is_published: bool
    is_featured: bool
    sort_order: int
    download_count: int = 0
    table_of_contents: List[TocEntry] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
