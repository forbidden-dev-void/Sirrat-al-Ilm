"""
Pydantic v2 schemas — the public API contract
==============================================

Importing ``app.schemas`` gives you every request/response model in one
namespace, which keeps the route modules tidy.
"""

from app.schemas.admin import (
    ActiveUpdateRequest,
    AdminActivityRow,
    AdminPersonRow,
    AdminStats,
    Counters,
    RoleUpdateRequest,
    TopResource,
)
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    TokenPair,
    UpdateProfileRequest,
)
from app.schemas.blog import (
    BLOG_CATEGORIES,
    BlogPostCreate,
    BlogPostOut,
    BlogPostSummary,
    BlogPostUpdate,
)
from app.schemas.book import BookCreate, BookOut, BookUpdate, TocEntry
from app.schemas.content import (
    AboutOut,
    ContentStats,
    EducationEntry,
    ExperienceEntry,
    HeroContent,
    HomeOverview,
    SiteMeta,
    SocialLink,
)
from app.schemas.item import GalleryImage, ItemCreate, ItemOut, ItemUpdate
from app.schemas.progress import (
    ProgressDashboard,
    ProgressEntryOut,
    ProgressTotals,
    ProgressTypeStat,
    ProgressUpsertRequest,
)
from app.schemas.shelf import (
    ResourceCreate,
    ResourceOut,
    ResourceUpdate,
    ShelfCreate,
    ShelfOut,
    ShelfSummary,
    ShelfUpdate,
)
from app.schemas.user import AdminUserOut, UserOut, UserSummary

__all__ = [
    "AboutOut",
    "ActiveUpdateRequest",
    "AdminActivityRow",
    "AdminPersonRow",
    "AdminStats",
    "AdminUserOut",
    "AuthResponse",
    "BLOG_CATEGORIES",
    "BlogPostCreate",
    "BlogPostOut",
    "BlogPostSummary",
    "BlogPostUpdate",
    "BookCreate",
    "BookOut",
    "BookUpdate",
    "ChangePasswordRequest",
    "ContentStats",
    "Counters",
    "EducationEntry",
    "ExperienceEntry",
    "GalleryImage",
    "HeroContent",
    "HomeOverview",
    "ItemCreate",
    "ItemOut",
    "ItemUpdate",
    "LoginRequest",
    "ProgressDashboard",
    "ProgressEntryOut",
    "ProgressTotals",
    "ProgressTypeStat",
    "ProgressUpsertRequest",
    "RefreshRequest",
    "ResourceCreate",
    "ResourceOut",
    "ResourceUpdate",
    "RoleUpdateRequest",
    "ShelfCreate",
    "ShelfOut",
    "ShelfSummary",
    "ShelfUpdate",
    "SignupRequest",
    "SiteMeta",
    "SocialLink",
    "TocEntry",
    "TokenPair",
    "TopResource",
    "UpdateProfileRequest",
    "UserOut",
    "UserSummary",
]
