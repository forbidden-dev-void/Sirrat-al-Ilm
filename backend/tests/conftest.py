"""
Pytest configuration & fixtures
===============================

The suite boots the *real* FastAPI app against a throwaway SQLite file, so it
exercises the same code paths as production (middleware, dependencies, seed
data, RBAC) — no mocks.

Environment variables are set **before** ``app.core.config`` is imported,
because settings are read once at import time.
"""

from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path
from typing import Dict, Iterator

# --- Test environment (must precede any ``app.*`` import) --------------------
_TMP_DIR = Path(tempfile.mkdtemp(prefix="sirrat-tests-"))
TEST_DB_PATH = _TMP_DIR / "test.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["ENVIRONMENT"] = "development"
os.environ["DEBUG"] = "false"
os.environ["JWT_SECRET_KEY"] = "unit-test-signing-key-not-a-secret-0123456789"
os.environ["ADMIN_EMAIL"] = "owner@example.com"
os.environ["ADMIN_FULL_NAME"] = "Test Owner"
os.environ["ADMIN_SEED_PASSWORD"] = "OwnerPass123"
os.environ["SEED_CONTENT_ON_STARTUP"] = "true"
os.environ["PBKDF2_ITERATIONS"] = "1000"  # keep the suite fast; format is identical
os.environ["CORS_ORIGINS"] = "http://testserver"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_SEED_PASSWORD"]


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    """One app instance for the whole session (lifespan runs the seeder once)."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def admin_headers(client: TestClient) -> Dict[str, str]:
    """Bearer header for the owner/administrator account."""
    response = client.post(
        "/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, response.text
    token = response.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_id(client: TestClient, admin_headers: Dict[str, str]) -> int:
    return int(client.get("/api/auth/me", headers=admin_headers).json()["id"])


def unique_email(prefix: str = "learner") -> str:
    """A fresh, non-colliding e-mail address for signup tests."""
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture
def new_user(client: TestClient) -> Dict[str, object]:
    """Sign up a brand-new learner and return their credentials + headers."""
    email = unique_email()
    password = "StudyHard123"
    response = client.post(
        "/api/auth/signup",
        json={"full_name": "Test Learner", "email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return {
        "email": email,
        "password": password,
        "user": body["user"],
        "tokens": body["tokens"],
        "headers": {"Authorization": f"Bearer {body['tokens']['access_token']}"},
    }


@pytest.fixture(scope="session")
def seeded_home(client: TestClient, admin_headers: Dict[str, str]) -> Dict:
    """The landing payload produced by the seeder (session cached)."""
    response = client.get("/api/content/home", headers=admin_headers)
    assert response.status_code == 200, response.text
    return response.json()
