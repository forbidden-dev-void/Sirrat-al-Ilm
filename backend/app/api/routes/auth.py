"""
Authentication routes
=====================

POST /api/auth/signup   -> create an account, return JWTs + profile
POST /api/auth/login    -> e-mail + password sign-in (this is the gate the SPA
                           shows before any page is reachable)
POST /api/auth/refresh  -> exchange a refresh token for a fresh access token
GET  /api/auth/me       -> who am I?

Owner rule
----------
The account whose e-mail equals ``ADMIN_EMAIL`` is *always* an administrator:
it is promoted on sign-up and re-promoted on login. Nobody else can obtain the
role through this API — promotion is an admin-only action.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    normalise_email,
    password_policy_violation,
    password_needs_rehash,
)
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    TokenPair,
)
from app.schemas.user import UserOut

logger = logging.getLogger("sirrat.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _is_owner_email(email: str) -> bool:
    """True when this e-mail is the configured owner/administrator address."""
    return normalise_email(email) == normalise_email(settings.admin_email)


def _token_pair(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(str(user.id), role=user.role, email=user.email),
        refresh_token=create_refresh_token(str(user.id)),
        token_type="bearer",
        expires_in_minutes=settings.access_token_expire_minutes,
    )


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        user=UserOut.model_validate(user),
        tokens=_token_pair(user),
        is_admin=user.is_admin,
    )


def _find_by_email(db: Session, email: str) -> User | None:
    return db.execute(
        select(User).where(func.lower(User.email) == normalise_email(email))
    ).scalar_one_or_none()


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account",
)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """Register a new learner (or the owner, when the e-mail matches ADMIN_EMAIL)."""
    weakness = password_policy_violation(payload.password)
    if weakness:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=weakness)

    if _find_by_email(db, payload.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this e-mail already exists. Try signing in instead.",
        )

    user = User(
        email=normalise_email(payload.email),
        full_name=payload.full_name,
        role=UserRole.ADMIN.value if _is_owner_email(payload.email) else UserRole.USER.value,
    )
    user.set_password(payload.password)
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New account created: %s (role=%s)", user.email, user.role)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse, summary="Sign in with e-mail + password")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """
    Verify credentials and return tokens.

    The same generic message is used for "unknown e-mail" and "wrong password"
    so the endpoint cannot be used to enumerate registered addresses.
    """
    user = _find_by_email(db, payload.email)
    if user is None or not user.verify_password(payload.password):
        logger.warning("Failed sign-in attempt for %s", normalise_email(payload.email))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect e-mail or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact the site owner.",
        )

    # Transparently upgrade legacy hashes that used a cheaper cost factor.
    if password_needs_rehash(user.password_hash):
        user.set_password(payload.password)

    # The owner can never lose admin rights (see module docstring).
    if _is_owner_email(user.email) and user.role != UserRole.ADMIN.value:
        user.role = UserRole.ADMIN.value

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    logger.info("Sign-in: %s (role=%s)", user.email, user.role)
    return _auth_response(user)


@router.post("/refresh", response_model=AuthResponse, summary="Rotate an access token")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """Exchange a valid refresh token for a new token pair."""
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc

    user = db.get(User, int(claims["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid"
        )
    return _auth_response(user)


@router.get("/me", response_model=UserOut, summary="Current profile")
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Return the profile of the bearer of the current access token."""
    return UserOut.model_validate(current_user)
