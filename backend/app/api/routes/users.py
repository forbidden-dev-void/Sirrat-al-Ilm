"""
User self-service routes
========================

GET    /api/users/me            -> profile (alias of /api/auth/me)
PATCH  /api/users/me            -> update name / bio / avatar / occupation
POST   /api/users/me/password   -> change password (requires the current one)
DELETE /api/users/me            -> delete my account and its learning history

Nothing here can grant admin rights: role changes live in the admin router.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_active_user
from app.core.security import password_policy_violation, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, UpdateProfileRequest
from app.schemas.user import UserOut

logger = logging.getLogger("sirrat.users")

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserOut, summary="My profile")
def read_profile(current_user: User = Depends(get_active_user)) -> UserOut:
    """Return the signed-in user's profile."""
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut, summary="Update my profile")
def update_profile(
    payload: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
) -> UserOut:
    """Apply a partial profile update from the dashboard Settings tab."""
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No fields supplied to update."
        )

    for field, value in updates.items():
        setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    logger.info("Profile updated for user id=%s fields=%s", current_user.id, sorted(updates))
    return UserOut.model_validate(current_user)


@router.post("/me/password", response_model=UserOut, summary="Change my password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
) -> UserOut:
    """Rotate the password after verifying the current one."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Your current password is incorrect."
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The new password must be different from the current one.",
        )
    weakness = password_policy_violation(payload.new_password)
    if weakness:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=weakness)

    current_user.set_password(payload.new_password)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    logger.info("Password changed for user id=%s", current_user.id)
    return UserOut.model_validate(current_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete my account")
def delete_account(
    db: Session = Depends(get_db), current_user: User = Depends(get_active_user)
) -> None:
    """
    Hard-delete the signed-in account (progress rows cascade).

    The owner account is protected: deleting it would orphan the site, so use
    Admin -> People to deactivate accounts instead.
    """
    from app.core.config import settings
    from app.core.security import normalise_email

    if normalise_email(current_user.email) == normalise_email(settings.admin_email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The owner account cannot be deleted from the dashboard.",
        )
    db.delete(current_user)
    db.commit()
    logger.info("Account deleted: id=%s", current_user.id)
