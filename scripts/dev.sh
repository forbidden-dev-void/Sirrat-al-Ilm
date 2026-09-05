#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# dev.sh — run the API and the Vite dev server side by side
# ---------------------------------------------------------------------------
# Backend : http://localhost:8000  (FastAPI + interactive docs at /api/docs)
# Frontend: http://localhost:5173  (Vite, proxies every /api call to :8000)
#
# Open the Vite URL in the browser; both processes are killed together on
# Ctrl-C thanks to the trap below.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Prefer the repository virtualenv when it exists, otherwise fall back to PATH.
if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON="$ROOT_DIR/.venv/bin/python"
else
  PYTHON="python3"
fi

cleanup() {
  echo
  echo "==> Stopping dev servers"
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting FastAPI on :8000 (python: $PYTHON)"
(
  cd "$BACKEND_DIR"
  "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) &

echo "==> Starting Vite on :5173"
(
  cd "$FRONTEND_DIR"
  [[ -d node_modules ]] || npm install
  npm run dev
) &

wait
