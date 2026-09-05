"""
Health & discovery routes (public)
==================================

GET /api/health -> liveness + database round-trip. Used by Docker HEALTHCHECK,
                   uptime monitors and the SPA's "connection lost" banner.
GET /api/info   -> tiny service card with links to the docs.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness probe")
def health(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Return service status and verify the database connection with a real query."""
    database_ok = True
    detail: str = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - only when the DB is down
        database_ok = False
        detail = f"{type(exc).__name__}: {exc}"

    return {
        "status": "ok" if database_ok else "degraded",
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "database": {"ok": database_ok, "detail": detail, "backend": "sqlite" if settings.is_sqlite else "postgresql"},
    }


@router.get("/info", summary="API service card")
def service_card() -> Dict[str, Any]:
    """Public service card.

    Also advertises the demo learner when one is seeded, so the sign-in screen
    can print credentials that are guaranteed to match the database instead of
    hard-coding them in the front end. Never includes the owner's account.
    """
    demo_account: Optional[Dict[str, str]] = None
    if settings.demo_account_enabled:
        demo_account = {
            "email": settings.demo_learner_email,
            "password": settings.demo_learner_password,
        }

    return {
        "name": settings.app_name,
        "tagline": settings.app_tagline,
        "version": settings.app_version,
        "docs": f"{settings.api_prefix}/docs",
        "health": f"{settings.api_prefix}/health",
        "demo_account": demo_account,
    }
