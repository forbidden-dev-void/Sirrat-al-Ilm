# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Sirrat al-Ilm — multi-stage production image
# ---------------------------------------------------------------------------
# Stage 1 (node)   : type-check and bundle the React SPA.
# Stage 2 (python) : install the API and serve BOTH the JSON API and the
#                    compiled SPA from a single origin on port 8000.
#
# The runtime image contains no Node toolchain and no source maps.
# ---------------------------------------------------------------------------

# ===========================================================================
# Stage 1 — frontend build
# ===========================================================================
FROM node:22-alpine AS frontend

WORKDIR /build

# Install dependencies first so this layer is cached until the lockfile changes.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Build: `tsc --noEmit && vite build` (fails the image on a type error).
COPY frontend/ ./
RUN npm run build


# ===========================================================================
# Stage 2 — runtime
# ===========================================================================
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System packages: curl-less healthchecks use python's urllib, so nothing extra
# is required beyond libpq for the PostgreSQL driver (psycopg ships a binary).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install -r backend/requirements.txt

# Application code, then the compiled SPA on top of it.
COPY backend/app ./backend/app
COPY --from=frontend /build/dist ./backend/app/static

# SQLite fallback location (used when DATABASE_URL is not PostgreSQL).
RUN mkdir -p /app/backend/data
VOLUME ["/app/backend/data"]

WORKDIR /app/backend

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD python -c "import sys,urllib.request; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"

# One worker keeps the in-process startup seeding deterministic; scale with
# `--workers` behind a load balancer once the database is shared.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
