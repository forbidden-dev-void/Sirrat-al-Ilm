"""
Application configuration
=========================

Every secret / environment specific value is read from environment variables
(never hard-coded). ``.env.example`` documents the full list.

Sections
--------
1.  Runtime           -> environment name, debug flag, API prefix
2.  Security          -> JWT signing key, token lifetime, password hashing cost
3.  Database          -> SQLAlchemy URL (SQLite by default, PostgreSQL in prod)
4.  Administrator     -> the single owner account that unlocks /admin
5.  CORS / static     -> allowed browser origins + built frontend location
"""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repository root  -> .../Sirrat-al-Ilm/backend/app/core/config.py  => parents[3]
BACKEND_DIR: Path = Path(__file__).resolve().parents[2]
REPO_ROOT: Path = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Strongly typed application settings loaded from env vars / .env file."""

    model_config = SettingsConfigDict(
        # Look for a .env in the backend folder first, then the repository root.
        env_file=(str(BACKEND_DIR / ".env"), str(REPO_ROOT / ".env")),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    # 1. Runtime                                                         #
    # ------------------------------------------------------------------ #
    app_name: str = "Sirrat al-Ilm"
    app_tagline: str = "Slow brew. Deep insights."
    app_version: str = "1.0.0"
    environment: str = Field(default="development", description="development | staging | production")
    debug: bool = False
    api_prefix: str = "/api"

    # ------------------------------------------------------------------ #
    # 2. Security                                                        #
    # ------------------------------------------------------------------ #
    # A random key is generated when nothing is configured. That is perfectly
    # safe for local development (tokens simply invalidate on restart) but it
    # is *rejected* in production so a real secret must always be supplied.
    jwt_secret_key: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12  # 12 hours
    refresh_token_expire_days: int = 30
    pbkdf2_iterations: int = 210_000  # OWASP recommended floor for PBKDF2-SHA256
    min_password_length: int = 8

    # ------------------------------------------------------------------ #
    # 3. Database                                                        #
    # ------------------------------------------------------------------ #
    # Default: zero-config SQLite file inside backend/data (git-ignored).
    # Production: set DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db
    database_url: str = "sqlite:///./data/sirrat_al_ilm.db"
    database_echo: bool = False

    # ------------------------------------------------------------------ #
    # 4. Administrator (owner-only account)                              #
    # ------------------------------------------------------------------ #
    admin_email: str = "rehanraeessayyed786@gmail.com"
    admin_full_name: str = "Rehan Rae Essayyed"
    # Optional bootstrap password. Leave EMPTY in production: the owner should
    # be provisioned with `python -m app.cli create-admin` or by signing up and
    # being promoted automatically because the e-mail matches ADMIN_EMAIL.
    admin_seed_password: str = ""

    # ------------------------------------------------------------------ #
    # 5. CORS, static assets and content seeding                         #
    # ------------------------------------------------------------------ #
    # Stored as the raw string from the environment so that both
    #   CORS_ORIGINS=https://a.com,https://b.com
    # and
    #   CORS_ORIGINS=["https://a.com"]
    # work. Use the ``cors_origin_list`` property in code.
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8000,http://127.0.0.1:8000"
    )
    # Serve the compiled React bundle from FastAPI when it exists.
    frontend_dist_dir: Path = BACKEND_DIR / "app" / "static"
    seed_content_on_startup: bool = True
    # The demo learner makes the dashboard reviewable out of the box: it comes
    # with a realistic, partially-finished progress history. Set to false (or
    # run with ENVIRONMENT=production, which skips it automatically) for a
    # clean database.
    seed_demo_learner: bool = True
    # These two are *public by design* — the sign-in page prints them so a
    # reviewer can explore the learner dashboard without creating an account.
    # They are deliberately NOT the owner's credentials; override them with
    # DEMO_LEARNER_EMAIL / DEMO_LEARNER_PASSWORD if you want a different demo.
    demo_learner_email: str = "learner@example.com"
    demo_learner_password: str = "Learner123"

    # Public site metadata used by the API + footer.
    site_owner: str = "Rehan Rae Essayyed"
    site_youtube_channel: str = "https://www.youtube.com/@sirrat-al-ilm"
    site_contact_email: str = "rehanraeessayyed786@gmail.com"

    # ------------------------------------------------------------------ #
    # Validators / derived helpers                                       #
    # ------------------------------------------------------------------ #
    @property
    def demo_account_enabled(self) -> bool:
        """True when the public demo learner is seeded and may be advertised."""
        return bool(self.seed_demo_learner) and self.environment != "production"

    @property
    def cors_origin_list(self) -> List[str]:
        """Comma-separated (or JSON array) CORS_ORIGINS as a clean list."""
        import json

        raw = (self.cors_origins or "").strip()
        if not raw:
            return []
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(origin).strip() for origin in parsed if str(origin).strip()]
            except json.JSONDecodeError:
                pass  # fall through to the comma separated form
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @field_validator("environment")
    @classmethod
    def _normalise_environment(cls, value: str) -> str:
        value = value.strip().lower()
        if value in {"prod", "production"}:
            return "production"
        if value in {"stage", "staging"}:
            return "staging"
        return "development"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    def resolved_database_url(self) -> str:
        """Turn relative SQLite paths into absolute ones (cwd independent)."""
        url = self.database_url
        if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
            relative = url.removeprefix("sqlite:///")
            path = Path(relative)
            if not path.is_absolute():
                path = BACKEND_DIR / path
            path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{path}"
        return url

    def assert_production_ready(self) -> List[str]:
        """Return a list of human readable configuration problems (empty = OK)."""
        problems: List[str] = []
        if not self.is_production:
            return problems
        if self.admin_seed_password:
            problems.append(
                "ADMIN_SEED_PASSWORD must not be set in production; "
                "provision the owner with `python -m app.cli create-admin` instead."
            )
        if self.debug:
            problems.append("DEBUG must be disabled in production.")
        if self.is_sqlite:
            problems.append("SQLite is not recommended in production; set DATABASE_URL to PostgreSQL.")
        return problems


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor (used as a FastAPI dependency)."""
    return Settings()


settings = get_settings()
