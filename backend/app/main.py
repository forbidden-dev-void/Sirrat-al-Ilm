"""
FastAPI application entry point
===============================

Boot sequence (see ``lifespan``)
--------------------------------
1. configure structured logging
2. create the SQLAlchemy engine + tables
3. bootstrap the owner account and seed the demo library
4. warn loudly (but do not crash) about unsafe production configuration

Mounted afterwards
------------------
* ``/api/*``      -> all routers (auth, content, progress, admin, health, media)
* ``/*``          -> the compiled React SPA (index.html + /assets) when present
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator, Callable

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError

from app.api.router import api_router
from app.core.config import settings
from app.db.session import create_all, dispose_engine, init_engine, get_session_factory
from app.services.seed import bootstrap_database

logger = logging.getLogger("sirrat")


# --------------------------------------------------------------------------- #
# Logging                                                                      #
# --------------------------------------------------------------------------- #
def configure_logging() -> None:
    """Compact, level-based console logging (JSON-ish enough for log shippers)."""
    level = logging.DEBUG if settings.debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-7s | %(name)-18s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    # Third-party noise down, app logs up.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING if not settings.database_echo else logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING if settings.is_production else logging.INFO)


# --------------------------------------------------------------------------- #
# Lifespan (startup / shutdown)                                                #
# --------------------------------------------------------------------------- #
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    logger.info("Starting %s v%s (%s)", settings.app_name, settings.app_version, settings.environment)

    # 1. Database -------------------------------------------------------------
    init_engine()
    try:
        create_all()
    except SQLAlchemyError as exc:
        # A misconfigured DATABASE_URL must fail fast with a readable message.
        logger.error("Database initialisation failed: %s", exc)
        raise

    # 2. Owner account + demo content ----------------------------------------
    if settings.seed_content_on_startup:
        session = get_session_factory()()
        try:
            bootstrap_database(session, seed=True)
        except Exception as exc:  # keep the app bootable even if seeding fails
            session.rollback()
            logger.exception("Seeding failed (continuing): %s", exc)
        finally:
            session.close()

    # 3. Production readiness warnings ---------------------------------------
    for problem in settings.assert_production_ready():
        logger.warning("Configuration: %s", problem)

    app.state.started_at = time.time()
    logger.info("Ready — API on %s, SPA %s", settings.api_prefix, _spa_state())
    try:
        yield
    finally:
        dispose_engine()
        logger.info("Shutdown complete")


def _spa_state() -> str:
    return "served" if (settings.frontend_dist_dir / "index.html").exists() else "not built (run scripts/build.sh)"


# --------------------------------------------------------------------------- #
# Application                                                                  #
# --------------------------------------------------------------------------- #
app = FastAPI(
    title=settings.app_name,
    description=(
        "Sirrat al-Ilm — a free knowledge library: religion & self-improvement shelves, "
        "programming course shelves, books, labs and a blog, with per-user progress "
        "tracking and an owner-only admin console."
    ),
    version=settings.app_version,
    lifespan=lifespan,
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=f"{settings.api_prefix}/redoc",
    openapi_url=f"{settings.api_prefix}/openapi.json",
)

# --- CORS (development; production serves the SPA from the same origin) ------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "X-Access-Token", "Content-Type", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def security_and_timing_headers(request: Request, call_next: Callable) -> Response:
    """Add baseline security headers + a server-timing header to every response."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    response.headers.setdefault(
        "Content-Security-Policy",
        (
            "default-src 'self'; img-src 'self' data: https://img.youtube.com https://i.ytimg.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "script-src 'self'; connect-src 'self'; frame-ancestors 'self'; "
            "object-src 'none'; base-uri 'self'"
        ),
    )
    return response


# --------------------------------------------------------------------------- #
# Error handling — always JSON, never a stack trace                            #
# --------------------------------------------------------------------------- #
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Normalise Pydantic 422s into ``{detail, errors:[{field, message}]}``."""
    errors = []
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", []) if part not in ("body", "query")]
        errors.append(
            {
                "field": ".".join(location) or "request",
                "message": error.get("msg", "Invalid value"),
                "type": error.get("type", "value_error"),
            }
        )
    logger.info("Validation error on %s %s: %s", request.method, request.url.path, errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation failed", "errors": errors},
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Database failures become a clean 500 (the driver message stays in logs)."""
    logger.exception("Database error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred. Please try again shortly."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last-resort handler: log everything, expose nothing."""
    logger.exception("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# --------------------------------------------------------------------------- #
# Routes                                                                       #
# --------------------------------------------------------------------------- #
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", include_in_schema=False, response_model=None)
def root() -> FileResponse | RedirectResponse:
    """Serve the SPA when it is built, otherwise point at the interactive docs."""
    index = settings.frontend_dist_dir / "index.html"
    if index.exists():
        return FileResponse(index)
    return RedirectResponse(url=f"{settings.api_prefix}/docs")


# --- Static SPA ------------------------------------------------------------- #
# The React build is copied into ``backend/app/static`` by scripts/build.sh (and
# by the Docker image). Assets are served verbatim; every other GET falls back
# to index.html so client-side routes (/dashboard, /admin, ...) deep-link.
_static_dir: Path = settings.frontend_dist_dir
if (_static_dir / "assets").is_dir():
    app.mount(
        "/assets", StaticFiles(directory=str(_static_dir / "assets")), name="spa-assets"
    )


@app.get("/{full_path:path}", include_in_schema=False, response_model=None)
def spa_fallback(full_path: str) -> FileResponse | JSONResponse:
    """SPA history fallback (never intercepts /api/*)."""
    if full_path.startswith("api/") or full_path == "api":
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": "Not found"})

    candidate = (_static_dir / full_path).resolve()
    # Path-traversal guard: only serve files that really live inside static/.
    if (
        full_path
        and candidate.is_file()
        and str(candidate).startswith(str(_static_dir.resolve()))
    ):
        return FileResponse(candidate)

    index = _static_dir / "index.html"
    if not index.exists():
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "detail": "Front end is not built yet",
                "hint": "Run ./scripts/build.sh (or `npm run build` in /frontend) to compile the React app.",
            },
        )
    return FileResponse(index)
