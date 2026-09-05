"""
API dependencies
================

FastAPI dependency functions used across routers:

* ``get_db``            (re-exported from app.db.session)
* ``get_current_user``  -> validates the Bearer JWT, loads the user row
* ``get_active_user``   -> also rejects deactivated accounts
* ``require_admin``     -> owner-only guard for every ``/api/admin/*`` route
* ``get_optional_user`` -> lets public endpoints personalise their response
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import TokenError, decode_token, normalise_email
from app.db.session import get_db
from app.models.user import User, UserRole

# ``auto_error=False`` so we can return a clean 401 instead of FastAPI's default
# WWW-Authenticate challenge, which some browsers surface as a login popup.
bearer_scheme = HTTPBearer(auto_error=False, description="JWT access token")

#: Fallback transport for the access token.
#:
#: ``Authorization: Bearer …`` is the standard and stays the primary header.
#: Some reverse proxies strip ``Authorization`` before the request reaches the
#: application (hosted preview tunnels do exactly this), which would sign every
#: visitor out even though their token is perfectly valid. The SPA therefore
#: also sends the same token in ``X-Access-Token``, and we accept either.
ACCESS_TOKEN_HEADER = "x-access-token"

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def extract_access_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[str]:
    """Return the caller's access token, from either supported header."""
    if credentials is not None and credentials.credentials:
        return credentials.credentials.strip()

    fallback = request.headers.get(ACCESS_TOKEN_HEADER, "")
    if fallback:
        # Tolerate a "Bearer <token>" value here as well.
        if fallback.lower().startswith("bearer "):
            fallback = fallback.split(" ", 1)[1]
        return fallback.strip() or None
    return None


def _user_from_token(token: Optional[str], db: Session) -> Optional[User]:
    """Decode an access token and return the matching user (or ``None``)."""
    if not token:
        return None
    try:
        payload = decode_token(token, expected_type="access")
    except TokenError:
        raise CREDENTIALS_EXCEPTION

    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise CREDENTIALS_EXCEPTION
    return user


def get_optional_user(
    token: Optional[str] = Depends(extract_access_token),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return the signed-in user when a valid token is present, else ``None``."""
    if token is None:
        return None
    return _user_from_token(token, db)


def get_current_user(
    token: Optional[str] = Depends(extract_access_token),
    db: Session = Depends(get_db),
) -> User:
    """Require a valid access token; raise 401 otherwise."""
    user = _user_from_token(token, db)
    if user is None:
        raise CREDENTIALS_EXCEPTION
    return user


def get_active_user(user: User = Depends(get_current_user)) -> User:
    """Require a valid token *and* an account that has not been deactivated."""
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact the site owner.",
        )
    return user


def require_admin(user: User = Depends(get_active_user)) -> User:
    """
    Owner-only guard.

    Two conditions grant admin rights:
      1. the user's stored ``role`` is ``admin``; **or**
      2. their e-mail equals ``ADMIN_EMAIL`` (the owner address configured in
         the environment) — this guarantees the owner can never be locked out
         of their own site, and nobody else can self-promote.
    """
    if user.is_admin or normalise_email(user.email) == normalise_email(settings.admin_email):
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Administrator privileges are required for this action.",
    )


def get_current_user_from_request(request: Request, db: Session = Depends(get_db)) -> User:
    """Fallback used by static-file/SPA routes that cannot declare headers."""
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        token = header.split(" ", 1)[1].strip()
    else:
        token = request.headers.get(ACCESS_TOKEN_HEADER, "").strip()
    if not token:
        raise CREDENTIALS_EXCEPTION
    try:
        payload = decode_token(token, expected_type="access")
    except TokenError:
        raise CREDENTIALS_EXCEPTION
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise CREDENTIALS_EXCEPTION
    return user


def list_admin_emails(db: Session) -> list[str]:
    """Every e-mail currently holding the admin role (used by the CLI)."""
    rows = db.execute(select(User.email).where(User.role == UserRole.ADMIN.value)).scalars().all()
    return [normalise_email(email) for email in rows]
