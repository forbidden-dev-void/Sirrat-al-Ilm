"""ORM model registry — importing this package registers every table."""

from app.models.blog import BlogPost
from app.models.book import Book
from app.models.item import AvailabilityStatus, Item
from app.models.progress import ProgressEntry, ProgressStatus, ResourceType
from app.models.shelf import Resource, Shelf, ShelfKind
from app.models.site_setting import SiteSetting
from app.models.user import User, UserRole

__all__ = [
    "BlogPost",
    "Book",
    "AvailabilityStatus",
    "Item",
    "ProgressEntry",
    "ProgressStatus",
    "ResourceType",
    "Resource",
    "Shelf",
    "ShelfKind",
    "SiteSetting",
    "User",
    "UserRole",
]
