"""
API router aggregation
======================

One place lists every router mounted under ``settings.api_prefix`` (``/api``).
Order matters only for OpenAPI grouping, not for matching.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import admin, auth, content, health, media, progress, users

api_router = APIRouter()

# Public
api_router.include_router(health.router)
api_router.include_router(media.router)

# Authentication & account self-service
api_router.include_router(auth.router)
api_router.include_router(users.router)

# Content (requires a session)
api_router.include_router(content.router)

# Learning progress (requires a session)
api_router.include_router(progress.router)

# Owner only
api_router.include_router(admin.router)

__all__ = ["api_router"]
