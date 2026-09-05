# ---------------------------------------------------------------------------
# Sirrat al-Ilm — developer tasks
# ---------------------------------------------------------------------------
# `make help` lists everything. The virtualenv python is preferred when it
# exists so the targets work without activating anything first.
# ---------------------------------------------------------------------------

VENV      := .venv
PY        := $(VENV)/bin/python
PIP       := $(VENV)/bin/pip
NPM       := npm
BACKEND   := backend
FRONTEND  := frontend
PORT      := 8000

.DEFAULT_GOAL := help
.PHONY: help install install-py install-js dev serve build typecheck test test-backend
.PHONY: test-frontend seed reset admin users docker-build docker-up docker-down
.PHONY: docker-logs clean

## help: list the available targets
help:
	@echo 'Sirrat al-Ilm — available targets:'
	@echo ''
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## /  make /'
	@echo ''

## install: python venv + dependencies + npm dependencies
install: install-py install-js

install-py:
	@test -d $(VENV) || python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r $(BACKEND)/requirements.txt

install-js:
	cd $(FRONTEND) && $(NPM) install

## dev: API on :8000 (reload) + Vite on :5173 (proxies /api)
dev:
	./scripts/dev.sh

## build: type-check + bundle the SPA into backend/app/static
build:
	./scripts/build.sh

## serve: build, then serve API + SPA from one origin on :8000
serve: build
	cd $(BACKEND) && ../$(PY) -m uvicorn app.main:app --host 0.0.0.0 --port $(PORT)

## typecheck: TypeScript only (no bundle)
typecheck:
	cd $(FRONTEND) && $(NPM) run typecheck

## test: backend pytest + frontend vitest
test: test-backend test-frontend

## test-backend: run the FastAPI test suite
test-backend:
	cd $(BACKEND) && ../$(PY) -m pytest -q

## test-frontend: run the Vitest unit tests
test-frontend:
	cd $(FRONTEND) && $(NPM) run test

## seed: idempotent re-seed of shelves, books, labs and posts
seed:
	cd $(BACKEND) && ../$(PY) -m app.cli seed

## reset: drop, recreate and re-seed the database (destroys data)
reset:
	cd $(BACKEND) && ../$(PY) -m app.cli reset

## admin: create or repair the owner account interactively
admin:
	cd $(BACKEND) && ../$(PY) -m app.cli create-admin

## users: list accounts and roles
users:
	cd $(BACKEND) && ../$(PY) -m app.cli users

## docker-build: build the production image
docker-build:
	docker compose build

## docker-up: build and start app + PostgreSQL 16
docker-up:
	docker compose up --build -d
	@echo 'App on http://localhost:$(PORT)  (docs at /api/docs)'

## docker-down: stop the stack (data volumes are kept)
docker-down:
	docker compose down

## docker-logs: tail the application logs
docker-logs:
	docker compose logs -f app

## clean: remove build artefacts and caches
clean:
	rm -rf $(FRONTEND)/dist $(BACKEND)/app/static/assets $(BACKEND)/app/static/index.html
	find . -type d -name __pycache__ -not -path './$(VENV)/*' -prune -exec rm -rf {} +
	rm -rf $(BACKEND)/.pytest_cache $(FRONTEND)/node_modules/.vite

