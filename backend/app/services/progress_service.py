"""
Progress service
================

All learning-progress logic lives here so the API routes stay thin and the same
rules apply everywhere (user dashboard, admin analytics, book downloads).

Responsibilities
----------------
* ``snapshot_for``      -> resolve a resource reference into title/slug/meta
* ``upsert_progress``   -> create-or-update one progress row (idempotent)
* ``build_dashboard``   -> aggregate a user's history for /dashboard
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.blog import BlogPost
from app.models.book import Book
from app.models.item import Item
from app.models.progress import ProgressEntry, ProgressStatus, ResourceType
from app.models.shelf import Resource, Shelf
from app.models.user import User
from app.schemas.progress import (
    ProgressDashboard,
    ProgressEntryOut,
    ProgressTotals,
    ProgressTypeStat,
    ProgressUpsertRequest,
)


class UnknownResourceError(Exception):
    """Raised when the client references a resource that does not exist."""


def snapshot_for(
    db: Session, resource_type: str, resource_id: int
) -> Optional[Tuple[str, Optional[str], Dict[str, Any]]]:
    """Return ``(title, slug, meta)`` for a resource, or ``None`` if unknown."""
    if resource_type == ResourceType.VIDEO.value:
        resource = db.get(Resource, resource_id)
        if resource is None:
            return None
        shelf = db.get(Shelf, resource.shelf_id)
        return (
            resource.title,
            shelf.slug if shelf else None,
            {
                "thumbnail_url": resource.thumbnail_url,
                "external_url": resource.external_url,
                "channel": resource.channel,
                "duration_label": resource.duration_label,
                "video_id": resource.video_id,
                "level": resource.level,
                "language": resource.language,
                "shelf": shelf.title if shelf else None,
                "shelf_kind": shelf.kind if shelf else None,
            },
        )

    if resource_type == ResourceType.BOOK.value:
        book = db.get(Book, resource_id)
        if book is None:
            return None
        return (
            book.title,
            book.slug,
            {
                "cover_url": book.cover_url,
                "category": book.category,
                "pages": book.pages,
                "author": book.author,
                "file_url": book.file_url,
            },
        )

    if resource_type == ResourceType.BLOG.value:
        post = db.get(BlogPost, resource_id)
        if post is None:
            return None
        return (
            post.title,
            post.slug,
            {
                "category": post.category,
                "reading_minutes": post.reading_minutes,
                "excerpt": post.excerpt,
                "cover_image": post.cover_image,
            },
        )

    if resource_type == ResourceType.LAB.value:
        item = db.get(Item, resource_id)
        if item is None:
            return None
        return (
            item.title,
            item.slug,
            {
                "image_url": item.image_url,
                "category": item.category,
                "availability_status": item.availability_status,
                "external_url": item.external_url,
            },
        )

    return None


def _derive_status(percent: Optional[int], requested: Optional[str]) -> str:
    """Decide the stored status from the percentage / explicit request."""
    if requested:
        return requested
    if percent is None:
        return ProgressStatus.IN_PROGRESS.value
    if percent >= 100:
        return ProgressStatus.COMPLETED.value
    if percent <= 0:
        return ProgressStatus.NOT_STARTED.value
    return ProgressStatus.IN_PROGRESS.value


def upsert_progress(db: Session, user: User, payload: ProgressUpsertRequest) -> ProgressEntry:
    """Create or update the progress row for ``(user, resource)``."""
    entry = db.execute(
        select(ProgressEntry).where(
            ProgressEntry.user_id == user.id,
            ProgressEntry.resource_type == payload.resource_type,
            ProgressEntry.resource_id == payload.resource_id,
        )
    ).scalar_one_or_none()

    title, slug, meta = (None, None, {})
    snapshot = snapshot_for(db, payload.resource_type, payload.resource_id)
    if snapshot is not None:
        title, slug, meta = snapshot
    elif entry is None:
        # Brand-new reference to something that does not exist -> 404 upstream.
        raise UnknownResourceError(
            f"{payload.resource_type} #{payload.resource_id} does not exist"
        )
    else:
        # Keep the stored snapshot when the resource was removed/unpublished.
        title, slug, meta = entry.resource_title, entry.resource_slug, entry.meta

    now = datetime.now(timezone.utc)
    percent = payload.progress_percent
    status = _derive_status(percent, payload.status)

    if entry is None:
        entry = ProgressEntry(
            user_id=user.id,
            resource_type=payload.resource_type,
            resource_id=payload.resource_id,
        )
        db.add(entry)

    entry.resource_title = title or payload.resource_title or "Untitled resource"
    entry.resource_slug = slug if slug is not None else payload.resource_slug
    if payload.meta:
        merged = dict(meta or {})
        merged.update(payload.meta)
        entry.meta = merged
    else:
        entry.meta = meta or {}

    if percent is not None:
        entry.progress_percent = max(0, min(100, int(percent)))
    elif status == ProgressStatus.COMPLETED.value:
        entry.progress_percent = 100

    entry.status = status
    if payload.notes is not None:
        entry.notes = payload.notes
    entry.last_accessed_at = now

    if status == ProgressStatus.COMPLETED.value:
        entry.completed_at = entry.completed_at or now
    else:
        entry.completed_at = None

    db.commit()
    db.refresh(entry)
    return entry


def _available_counts(db: Session) -> Dict[str, int]:
    """How many published resources exist per type (denominator for %)."""
    videos = db.execute(
        select(func.count(Resource.id))
        .join(Shelf, Shelf.id == Resource.shelf_id)
        .where(Resource.is_published.is_(True), Shelf.is_published.is_(True))
    ).scalar_one()
    books = db.execute(
        select(func.count(Book.id)).where(Book.is_published.is_(True))
    ).scalar_one()
    posts = db.execute(
        select(func.count(BlogPost.id)).where(BlogPost.is_published.is_(True))
    ).scalar_one()
    labs = db.execute(select(func.count(Item.id))).scalar_one()
    return {
        ResourceType.VIDEO.value: int(videos or 0),
        ResourceType.BOOK.value: int(books or 0),
        ResourceType.BLOG.value: int(posts or 0),
        ResourceType.LAB.value: int(labs or 0),
    }


TYPE_LABELS: Dict[str, str] = {
    ResourceType.VIDEO.value: "Videos watched",
    ResourceType.BOOK.value: "Books read",
    ResourceType.BLOG.value: "Articles read",
    ResourceType.LAB.value: "Labs explored",
}


def build_dashboard(db: Session, user: User) -> ProgressDashboard:
    """Aggregate one user's learning history into the dashboard payload."""
    entries: List[ProgressEntry] = list(
        db.execute(
            select(ProgressEntry)
            .where(ProgressEntry.user_id == user.id)
            .order_by(ProgressEntry.last_accessed_at.desc())
        )
        .scalars()
        .all()
    )

    available = _available_counts(db)
    per_type_started: Dict[str, int] = {key: 0 for key in TYPE_LABELS}
    per_type_completed: Dict[str, int] = {key: 0 for key in TYPE_LABELS}

    for entry in entries:
        if entry.resource_type not in per_type_started:
            continue
        per_type_started[entry.resource_type] += 1
        if entry.status == ProgressStatus.COMPLETED.value:
            per_type_completed[entry.resource_type] += 1

    completed_entries = [
        entry for entry in entries if entry.status == ProgressStatus.COMPLETED.value
    ]
    in_progress = [
        entry
        for entry in entries
        if entry.status == ProgressStatus.IN_PROGRESS.value and entry.progress_percent > 0
    ]
    saved = [
        entry
        for entry in entries
        if entry.status == ProgressStatus.NOT_STARTED.value or (entry.notes or "").strip()
    ]

    total_started = len(entries)
    totals = ProgressTotals(
        tracked=total_started,
        completed=len(completed_entries),
        in_progress=len(in_progress),
        completion_rate=round((len(completed_entries) / total_started) * 100, 1) if total_started else 0.0,
        videos=per_type_completed[ResourceType.VIDEO.value],
        books=per_type_completed[ResourceType.BOOK.value],
        blogs=per_type_completed[ResourceType.BLOG.value],
        labs=per_type_completed[ResourceType.LAB.value],
    )

    by_type = [
        ProgressTypeStat(
            key=key,
            label=TYPE_LABELS[key],
            available=available.get(key, 0),
            started=per_type_started[key],
            completed=per_type_completed[key],
            percent=round(
                (per_type_completed[key] / available[key]) * 100, 1
            )
            if available.get(key)
            else 0.0,
        )
        for key in TYPE_LABELS
    ]

    return ProgressDashboard(
        totals=totals,
        by_type=by_type,
        continue_learning=[ProgressEntryOut.model_validate(entry) for entry in in_progress[:8]],
        completed=[ProgressEntryOut.model_validate(entry) for entry in completed_entries[:12]],
        saved=[ProgressEntryOut.model_validate(entry) for entry in saved[:12]],
        recent_activity=[ProgressEntryOut.model_validate(entry) for entry in entries[:10]],
    )
