"""
Learning-progress routes (user dashboard)
=========================================

GET    /api/progress              -> aggregated dashboard payload
GET    /api/progress/entries      -> raw rows (filterable by type/status)
PUT    /api/progress              -> create-or-update one row (idempotent)
PATCH  /api/progress/{id}/notes   -> save a personal note
POST   /api/progress/{id}/complete-> mark finished
DELETE /api/progress/{id}         -> remove from my history

A user can only ever touch **their own** rows; every query is scoped by
``user_id`` and cross-user access returns 404 (not 403) so ids cannot be
probed.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_active_user
from app.db.session import get_db
from app.models.progress import ProgressEntry
from app.models.user import User
from app.schemas.progress import (
    ProgressDashboard,
    ProgressEntryOut,
    ProgressNotesRequest,
    ProgressUpsertRequest,
)
from app.services.progress_service import UnknownResourceError, build_dashboard, upsert_progress

logger = logging.getLogger("sirrat.progress")

router = APIRouter(prefix="/progress", tags=["Learning progress"])


def _own_entry(db: Session, user: User, entry_id: int) -> ProgressEntry:
    entry = db.get(ProgressEntry, entry_id)
    if entry is None or entry.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Progress entry not found")
    return entry


@router.get("", response_model=ProgressDashboard, summary="My learning dashboard")
def dashboard(
    db: Session = Depends(get_db), user: User = Depends(get_active_user)
) -> ProgressDashboard:
    return build_dashboard(db, user)


@router.get("/entries", response_model=List[ProgressEntryOut], summary="My progress rows")
def entries(
    resource_type: Optional[str] = Query(default=None, pattern="^(video|book|blog|lab)$"),
    entry_status: Optional[str] = Query(
        default=None, alias="status", pattern="^(not_started|in_progress|completed)$"
    ),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_active_user),
) -> List[ProgressEntryOut]:
    statement = select(ProgressEntry).where(ProgressEntry.user_id == user.id)
    if resource_type:
        statement = statement.where(ProgressEntry.resource_type == resource_type)
    if entry_status:
        statement = statement.where(ProgressEntry.status == entry_status)
    statement = statement.order_by(ProgressEntry.last_accessed_at.desc()).limit(limit)
    rows = db.execute(statement).scalars().all()
    return [ProgressEntryOut.model_validate(row) for row in rows]


@router.put("", response_model=ProgressEntryOut, summary="Track progress (upsert)")
def track(
    payload: ProgressUpsertRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_active_user),
) -> ProgressEntryOut:
    """Record that the user opened / progressed / completed a resource."""
    try:
        entry = upsert_progress(db, user, payload)
    except UnknownResourceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return ProgressEntryOut.model_validate(entry)


@router.patch("/{entry_id}/notes", response_model=ProgressEntryOut, summary="Save a note")
def save_notes(
    entry_id: int,
    payload: ProgressNotesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_active_user),
) -> ProgressEntryOut:
    """Attach/update the personal note stored next to a resource."""
    entry = _own_entry(db, user, entry_id)
    entry.notes = payload.notes
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return ProgressEntryOut.model_validate(entry)


@router.post("/{entry_id}/complete", response_model=ProgressEntryOut, summary="Mark complete")
def complete(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_active_user),
) -> ProgressEntryOut:
    """Force an entry to 100% / completed (used by the dashboard tick button)."""
    entry = _own_entry(db, user, entry_id)
    payload = ProgressUpsertRequest(
        resource_type=entry.resource_type,
        resource_id=entry.resource_id,
        status="completed",
        progress_percent=100,
        notes=entry.notes,
    )
    updated = upsert_progress(db, user, payload)
    logger.info("User id=%s completed %s#%s", user.id, entry.resource_type, entry.resource_id)
    return ProgressEntryOut.model_validate(updated)


@router.delete(
    "/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Remove from my history"
)
def remove(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_active_user),
) -> None:
    entry = _own_entry(db, user, entry_id)
    db.delete(entry)
    db.commit()
