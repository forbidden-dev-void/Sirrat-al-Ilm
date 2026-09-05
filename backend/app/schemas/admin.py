"""Admin-only schemas (dashboard counters, activity feed, people table)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class Counters(BaseModel):
    users: int = 0
    admins: int = 0
    new_users_last_7_days: int = 0
    shelves: int = 0
    resources: int = 0
    books: int = 0
    labs: int = 0
    posts: int = 0
    drafts: int = 0
    progress_entries: int = 0
    completions: int = 0
    book_downloads: int = 0
    post_views: int = 0


class TopResource(BaseModel):
    resource_type: str
    resource_id: int
    title: str
    engaged: int = 0
    completed: int = 0


class AdminPersonRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    progress_count: int = 0
    completed_count: int = 0


class AdminActivityRow(BaseModel):
    id: int
    user_id: int
    user_name: str
    resource_type: str
    title: str
    status: str
    progress_percent: int
    at: datetime


class RoleUpdateRequest(BaseModel):
    role: str = Field(pattern="^(admin|user)$")


class ActiveUpdateRequest(BaseModel):
    is_active: bool


class AdminStats(BaseModel):
    counters: Counters
    top_resources: List[TopResource] = Field(default_factory=list)
    recent_activity: List[AdminActivityRow] = Field(default_factory=list)
