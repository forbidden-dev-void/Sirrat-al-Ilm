"""Shelf + Resource schemas (YouTube shelves on the home page)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ResourceBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=220)
    description: str = Field(default="", max_length=2000)
    resource_type: str = Field(default="video", pattern="^(video|playlist|link)$")
    external_url: Optional[str] = Field(default=None, max_length=600)
    video_id: Optional[str] = Field(default=None, max_length=32)
    thumbnail_url: Optional[str] = Field(default=None, max_length=600)
    channel: Optional[str] = Field(default=None, max_length=120)
    duration_label: Optional[str] = Field(default=None, max_length=32)
    lesson_count: Optional[int] = Field(default=None, ge=0, le=500)
    level: Optional[str] = Field(default=None, max_length=32)
    language: Optional[str] = Field(default=None, max_length=32)
    is_published: bool = True
    is_featured: bool = False
    sort_order: int = 0


class ResourceCreate(ResourceBase):
    shelf_id: int


class ResourceUpdate(BaseModel):
    """Partial update — only supplied fields change."""

    model_config = ConfigDict(extra="forbid")

    shelf_id: Optional[int] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=220)
    description: Optional[str] = Field(default=None, max_length=2000)
    resource_type: Optional[str] = Field(default=None, pattern="^(video|playlist|link)$")
    external_url: Optional[str] = Field(default=None, max_length=600)
    video_id: Optional[str] = Field(default=None, max_length=32)
    thumbnail_url: Optional[str] = Field(default=None, max_length=600)
    channel: Optional[str] = Field(default=None, max_length=120)
    duration_label: Optional[str] = Field(default=None, max_length=32)
    lesson_count: Optional[int] = Field(default=None, ge=0, le=500)
    level: Optional[str] = Field(default=None, max_length=32)
    language: Optional[str] = Field(default=None, max_length=32)
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None


class ResourceOut(ResourceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    shelf_id: int
    created_at: datetime


class ShelfBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=180)
    slug: str = Field(min_length=2, max_length=200, pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$")
    kind: str = Field(default="wisdom", pattern="^(wisdom|programming|tech|books|life)$")
    subtitle: Optional[str] = Field(default=None, max_length=240)
    description: str = Field(default="", max_length=2000)
    cover_image: Optional[str] = Field(default=None, max_length=600)
    accent: Optional[str] = Field(default=None, max_length=32)
    is_published: bool = True
    sort_order: int = 0


class ShelfCreate(ShelfBase):
    resources: List[ResourceBase] = Field(default_factory=list)


class ShelfUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1, max_length=180)
    slug: Optional[str] = Field(default=None, min_length=2, max_length=200)
    kind: Optional[str] = Field(default=None, pattern="^(wisdom|programming|tech|books|life)$")
    subtitle: Optional[str] = Field(default=None, max_length=240)
    description: Optional[str] = Field(default=None, max_length=2000)
    cover_image: Optional[str] = Field(default=None, max_length=600)
    accent: Optional[str] = Field(default=None, max_length=32)
    is_published: Optional[bool] = None
    sort_order: Optional[int] = None

    @field_validator("slug")
    @classmethod
    def _slug_shape(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        import re

        if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", value):
            raise ValueError("Slug must be lowercase, numbers and dashes only")
        return value


class ShelfSummary(ShelfBase):
    """Shelf without its resources — used for lists and admin tables."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    resource_count: int = 0
    created_at: datetime


class ShelfOut(ShelfBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resources: List[ResourceOut] = Field(default_factory=list)
    created_at: datetime
