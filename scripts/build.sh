#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build.sh — produce the production bundle and hand it to the backend
# ---------------------------------------------------------------------------
# The API serves the SPA itself (single origin, no CORS surprises), so after
# `vite build` the contents of frontend/dist are copied into
# backend/app/static, which app/main.py mounts at /assets and falls back to
# index.html for every non-API route.
#
# Usage:  ./scripts/build.sh [--skip-install]
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
STATIC_DIR="$ROOT_DIR/backend/app/static"
SKIP_INSTALL="${1:-}"

echo "==> Sirrat al-Ilm frontend build"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found on PATH. Install Node.js 20+ and try again." >&2
  exit 1
fi

cd "$FRONTEND_DIR"

if [[ "$SKIP_INSTALL" != "--skip-install" ]]; then
  echo "==> Installing dependencies"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
fi

echo "==> Type-checking and bundling"
npm run build

echo "==> Copying dist/ into backend/app/static/"
mkdir -p "$STATIC_DIR"
rm -rf "$STATIC_DIR/assets" "$STATIC_DIR/index.html"
cp -R "$FRONTEND_DIR/dist/." "$STATIC_DIR/"

echo "==> Done. Start the API with:  cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000"
