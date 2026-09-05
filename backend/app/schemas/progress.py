"""
Progress schemas
================

``ProgressUpsertRequest`` is the single write endpoint used by the SPA when a
learner opens a video, marks a chapter read, or ticks something complete.
``ProgressDashboard`` is the pre-aggregated payload for /dashboard, so the
browser does one request instead of six.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProgressNotesRequest(BaseModel):
    """Body of ``PATCH /api/progress/{id}/notes``.

    The entry is identified by the path, so only the note itself is required —
    clients should not have to repeat the resource type/id to save a sentence.
    """

    notes: Optional[str] = Field(default=None, max_length=4000)


class ProgressUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resource_type: str = Field(pattern="^(video|book|blog|lab)$")
    resource_id: int = Field(gt=0)
    status: Optional[str] = Field(default=None, pattern="^(not_started|in_progress|completed)$")
    progress_percent: Optional[int] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = Field(default=None, max_length=4000)
    # Optional client supplied snapshot — the server overwrites it with the
    # authoritative title/meta when the resource exists in the database.
    resource_title: Optional[str] = Field(default=None, max_length=220)
    resource_slug: Optional[str] = Field(default=None, max_length=240)
    meta: Optional[Dict[str, Any]] = None

    @field_validator("progress_percent")
    @classmethod
    def _clamp(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return None
        return max(0, min(100, int(value)))


class ProgressEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    resource_type: str
    resource_id: int
    resource_title: str
    resource_slug: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
    status: str
    progress_percent: int
    notes: Optional[str] = None
    last_accessed_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ProgressTypeStat(BaseModel):
    """Per-shelf / per-format learning stats for the dashboard rings."""

    key: str
    label: str
    available: int = 0
    started: int = 0
    completed: int = 0
    percent: float = 0.0


class ProgressTotals(BaseModel):
    tracked: int = 0
    completed: int = 0
    in_progress: int = 0
    completion_rate: float = 0.0
    videos: int = 0
    books: int = 0
    blogs: int = 0
    labs: int = 0


class ProgressDashboard(BaseModel):
    totals: ProgressTotals
    by_type: List[ProgressTypeStat] = Field(default_factory=list)
    continue_learning: List[ProgressEntryOut] = Field(default_factory=list)
    completed: List[ProgressEntryOut] = Field(default_factory=list)
    saved: List[ProgressEntryOut] = Field(default_factory=list)
    recent_activity: List[ProgressEntryOut] = Field(default_factory=list)
