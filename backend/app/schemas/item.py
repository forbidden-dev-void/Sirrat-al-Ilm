"""Item (Lab listing) schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserSummary

GALLERY_ITEM_PATTERN = "Each gallery entry is an object with 'url' and optional 'caption'"


class GalleryImage(BaseModel):
    """One entry of the lab image-gallery placeholder grid."""

    model_config = ConfigDict(extra="forbid")

    url: str = Field(max_length=600)
    caption: Optional[str] = Field(default=None, max_length=180)
    alt: Optional[str] = Field(default=None, max_length=180)


class ItemBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=2, max_length=180)
    slug: Optional[str] = Field(default=None, max_length=200)
    description: str = Field(default="", max_length=20000)
    summary: Optional[str] = Field(default=None, max_length=400)
    image_url: Optional[str] = Field(default=None, max_length=600)
    category: Optional[str] = Field(default=None, max_length=80)
    kind: str = Field(default="lab", max_length=32)
    availability_status: str = Field(
        default="available", pattern="^(available|in_progress|archived|draft)$"
    )
    gallery: List[GalleryImage] = Field(default_factory=list, description=GALLERY_ITEM_PATTERN)
    tags: List[str] = Field(default_factory=list)
    external_url: Optional[str] = Field(default=None, max_length=600)
    is_featured: bool = False
    sort_order: int = 0


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=2, max_length=180)
    slug: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=20000)
    summary: Optional[str] = Field(default=None, max_length=400)
    image_url: Optional[str] = Field(default=None, max_length=600)
    category: Optional[str] = Field(default=None, max_length=80)
    kind: Optional[str] = Field(default=None, max_length=32)
    availability_status: Optional[str] = Field(
        default=None, pattern="^(available|in_progress|archived|draft)$"
    )
    gallery: Optional[List[GalleryImage]] = None
    tags: Optional[List[str]] = None
    external_url: Optional[str] = Field(default=None, max_length=600)
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    title: str
    slug: str
    description: str
    summary: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    kind: str
    availability_status: str
    gallery: List[Dict[str, Any]] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    external_url: Optional[str] = None
    is_featured: bool
    sort_order: int
    owner: Optional[UserSummary] = None
    created_at: datetime
    updated_at: datetime
