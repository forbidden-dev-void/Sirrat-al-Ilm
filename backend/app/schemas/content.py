"""
Content schemas — the aggregated payloads the SPA renders
=========================================================

The front end boots with **one** request (``GET /api/content/home``) that
returns hero copy, the About block, every published shelf, books, labs and the
latest posts. Fewer round-trips = instant landing page.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.blog import BlogPostSummary
from app.schemas.book import BookOut
from app.schemas.item import ItemOut
from app.schemas.shelf import ShelfOut


class SiteMeta(BaseModel):
    """Branding + links used by the navbar/footer."""

    app_name: str
    tagline: str
    version: str
    owner: str
    youtube_channel: str
    contact_email: str


class EducationEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    institution: str
    degree: str
    field: Optional[str] = None
    period: Optional[str] = None
    detail: Optional[str] = None


class ExperienceEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role: str
    organisation: str
    period: Optional[str] = None
    location: Optional[str] = None
    detail: Optional[str] = None
    highlights: List[str] = Field(default_factory=list)


class SocialLink(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: str
    url: str
    icon: Optional[str] = None


class AboutOut(BaseModel):
    """The "About myself, education, experience" block from the brief."""

    headline: str = ""
    intro: str = ""
    portrait_url: Optional[str] = None
    education: List[EducationEntry] = Field(default_factory=list)
    experience: List[ExperienceEntry] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    socials: List[SocialLink] = Field(default_factory=list)
    facts: Dict[str, str] = Field(default_factory=dict)


class HeroContent(BaseModel):
    eyebrow: str = ""
    title: str = ""
    highlight: str = ""
    subtitle: str = ""
    primary_cta_label: str = "Start learning"
    primary_cta_href: str = "/shelf/wisdom"
    secondary_cta_label: str = "Browse the library"
    secondary_cta_href: str = "/books"


class ContentStats(BaseModel):
    shelves: int = 0
    videos: int = 0
    books: int = 0
    labs: int = 0
    posts: int = 0


class HomeOverview(BaseModel):
    """Everything the landing page needs, in one typed payload."""

    site: SiteMeta
    hero: HeroContent
    about: AboutOut
    stats: ContentStats
    shelves: List[ShelfOut] = Field(default_factory=list)
    books: List[BookOut] = Field(default_factory=list)
    labs: List[ItemOut] = Field(default_factory=list)
    posts: List[BlogPostSummary] = Field(default_factory=list)
