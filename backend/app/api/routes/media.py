"""
Media routes
============

GET /api/media/art/{token}.svg -> deterministic placeholder artwork.

This endpoint is intentionally **public**: browsers load ``<img>`` sources
without an ``Authorization`` header, so requiring a token would break every
cover image. It only ever returns generated SVG for a token — no user data.
"""

from __future__ import annotations

from fastapi import APIRouter, Query, Response
from fastapi.responses import StreamingResponse
import io

from app.services.art import build_artwork_svg

router = APIRouter(prefix="/media", tags=["Media"])

# Artwork never changes for a token, so it can be cached aggressively by the
# browser and any CDN in front of the app.
_CACHE_CONTROL = "public, max-age=604800, immutable"


@router.get(
    "/art/{token}.svg",
    summary="Generated placeholder artwork",
    response_class=Response,
    response_model=None,
)
def artwork(
    token: str,
    label: str | None = Query(default=None, max_length=60),
    palette: str | None = Query(default=None, max_length=20),
    width: int = Query(default=800, ge=120, le=2400),
    height: int = Query(default=500, ge=120, le=2400),
) -> Response:
    """Return an SVG image derived deterministically from ``token``."""
    svg = build_artwork_svg(
        token, label=label, width=width, height=height, palette=palette
    )
    return StreamingResponse(
        io.BytesIO(svg),
        media_type="image/svg+xml",
        headers={
            "Cache-Control": _CACHE_CONTROL,
            "X-Content-Type-Options": "nosniff",
        },
    )
