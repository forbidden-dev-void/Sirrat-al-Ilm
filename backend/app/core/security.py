"""
Security primitives
===================

* Password hashing  -> PBKDF2-HMAC-SHA256 from the Python standard library.
  (Deliberately dependency free: no bcrypt/native wheels to compile, and the
  cost factor is configurable through ``PBKDF2_ITERATIONS``.)
* JWT access/refresh tokens -> PyJWT (HS256).
* Small validation helpers reused by the API schemas.

Stored hash format:  pbkdf2_sha256$<iterations>$<salt-b64>$<digest-b64>
The iteration count travels with the hash, so raising it later never breaks
existing users (their hash is transparently upgraded on next successful login).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import jwt

from app.core.config import settings

_ALGORITHM_NAME = "pbkdf2_sha256"
_SALT_BYTES = 16
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


# ---------------------------------------------------------------------------- #
# Password hashing                                                             #
# ---------------------------------------------------------------------------- #
def hash_password(plain_password: str, iterations: Optional[int] = None) -> str:
    """Return a salted PBKDF2-SHA256 hash string for ``plain_password``."""
    if not plain_password:
        raise ValueError("Password must not be empty")
    cost = iterations or settings.pbkdf2_iterations
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, cost)
    return "{}${}${}${}".format(
        _ALGORITHM_NAME,
        cost,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def _decode_stored_hash(stored: str) -> Optional[Tuple[int, bytes, bytes]]:
    parts = stored.split("$")
    if len(parts) != 4 or parts[0] != _ALGORITHM_NAME:
        return None
    try:
        return int(parts[1]), base64.b64decode(parts[2]), base64.b64decode(parts[3])
    except (ValueError, TypeError):
        return None


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Constant-time comparison of a candidate password against a stored hash."""
    decoded = _decode_stored_hash(stored_hash)
    if decoded is None or not plain_password:
        return False
    iterations, salt, expected = decoded
    candidate = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(candidate, expected)


def password_needs_rehash(stored_hash: str) -> bool:
    """True when the stored hash uses an older (cheaper) cost factor."""
    decoded = _decode_stored_hash(stored_hash)
    if decoded is None:
        return True
    return decoded[0] < settings.pbkdf2_iterations


# ---------------------------------------------------------------------------- #
# Validation helpers                                                           #
# ---------------------------------------------------------------------------- #
def is_valid_email(email: str) -> bool:
    """Lightweight structural e-mail check (Pydantic does the strict one)."""
    return bool(email) and len(email) <= 254 and _EMAIL_RE.match(email.strip()) is not None


def normalise_email(email: str) -> str:
    return (email or "").strip().lower()


def password_policy_violation(password: str) -> Optional[str]:
    """Return a readable reason why ``password`` is too weak, or ``None``."""
    if len(password) < settings.min_password_length:
        return f"Password must be at least {settings.min_password_length} characters long."
    if not re.search(r"[A-Za-z]", password):
        return "Password must contain at least one letter."
    if not re.search(r"\d", password):
        return "Password must contain at least one number."
    return None


# ---------------------------------------------------------------------------- #
# JWT                                                                          #
# ---------------------------------------------------------------------------- #
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(subject: str, *, role: str, email: str, expires_minutes: Optional[int] = None) -> str:
    """Create a signed short-lived access token."""
    expire_minutes = expires_minutes or settings.access_token_expire_minutes
    now = _utcnow()
    payload: Dict[str, Any] = {
        "sub": str(subject),
        "email": email,
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expire_minutes)).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str, *, expires_days: Optional[int] = None) -> str:
    """Create a signed long-lived refresh token (carries no e-mail/role)."""
    days = expires_days or settings.refresh_token_expire_days
    now = _utcnow()
    payload: Dict[str, Any] = {
        "sub": str(subject),
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=days)).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


class TokenError(Exception):
    """Raised when a JWT cannot be decoded / is the wrong type / expired."""


def decode_token(token: str, *, expected_type: str = "access") -> Dict[str, Any]:
    """Decode + validate a JWT, raising :class:`TokenError` on any problem."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:  # pragma: no cover - trivial branch
        raise TokenError("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Token is invalid") from exc

    if payload.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token")
    if not payload.get("sub"):
        raise TokenError("Token is missing a subject")
    return payload
