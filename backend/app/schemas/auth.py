"""
Auth schemas
============

Client-side validation lives in the React forms; these models are the
server-side guard-rails (Pydantic returns 422 with field-level messages that
the UI maps back onto the same inputs).
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import normalise_email
from app.schemas.user import UserOut


class SignupRequest(BaseModel):
    """Create an account. ``full_name`` + ``email`` + ``password`` only."""

    full_name: str = Field(min_length=2, max_length=120, description="Displayed on the profile card")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Please enter your full name")
        return cleaned

    @field_validator("email")
    @classmethod
    def _lower_email(cls, value: str) -> str:
        return normalise_email(value)


class LoginRequest(BaseModel):
    """E-mail + password sign-in."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, value: str) -> str:
        return normalise_email(value)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class AuthResponse(BaseModel):
    """Everything the SPA needs after a successful sign-in/sign-up."""

    user: UserOut
    tokens: TokenPair
    is_admin: bool


class RefreshRequest(BaseModel):
    refresh_token: str


class UpdateProfileRequest(BaseModel):
    """Partial profile update from the user dashboard -> Settings."""

    model_config = ConfigDict(extra="forbid")

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=1000)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    occupation: Optional[str] = Field(default=None, max_length=120)
    location: Optional[str] = Field(default=None, max_length=120)

    @field_validator("full_name")
    @classmethod
    def _strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        return cleaned or None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
