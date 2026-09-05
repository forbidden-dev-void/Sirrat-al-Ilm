"""
Administrator routes — owner only
=================================

Every endpoint in this module is guarded by ``require_admin`` (see
``app.core.deps``): the caller must hold the ``admin`` role **or** sign in with
the ``ADMIN_EMAIL`` address configured in the environment.

Sections
--------
1. Dashboard analytics   GET  /admin/stats
2. People                GET  /admin/people, PATCH role/active, DELETE
3. Shelves               GET  /admin/shelves, POST, PATCH, DELETE
4. Shelf resources       POST /admin/resources, PATCH, DELETE
5. Books                 GET  /admin/books, POST, PATCH, DELETE
6. Labs (Items)          GET  /admin/labs, POST, PATCH, DELETE
7. Blog posts            GET  /admin/posts, POST, PATCH, DELETE
8. Site content          GET  /admin/site-content, PUT hero/about
9. Maintenance           POST /admin/reseed
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_admin
from app.core.security import normalise_email
from app.db.session import get_db
from app.models.blog import BlogPost
from app.models.book import Book
from app.models.item import AvailabilityStatus, Item
from app.models.progress import ProgressEntry, ProgressStatus
from app.models.shelf import Resource, Shelf
from app.models.user import User, UserRole
from app.schemas.admin import (
    ActiveUpdateRequest,
    AdminActivityRow,
    AdminPersonRow,
    AdminStats,
    Counters,
    RoleUpdateRequest,
    TopResource,
)
from app.schemas.blog import BlogPostCreate, BlogPostOut, BlogPostUpdate
from app.schemas.book import BookCreate, BookOut, BookUpdate
from app.schemas.content import AboutOut, HeroContent
from app.schemas.item import ItemCreate, ItemOut, ItemUpdate
from app.schemas.shelf import (
    ResourceCreate,
    ResourceOut,
    ResourceUpdate,
    ShelfCreate,
    ShelfOut,
    ShelfSummary,
    ShelfUpdate,
)
from app.services.art import artwork_url
from app.services.seed import bootstrap_database
from app.services.site_content import (
    ABOUT_KEY,
    DEFAULT_ABOUT,
    DEFAULT_HERO,
    HERO_KEY,
    get_setting,
    set_setting,
)
from app.services.slug import unique_slug

logger = logging.getLogger("sirrat.admin")

router = APIRouter(prefix="/admin", tags=["Administrator"], dependencies=[Depends(require_admin)])


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #
def _cutoff(days: int) -> datetime:
    """UTC cutoff used for "last N days" counters.

    Always timezone-aware: the ``UTCDateTime`` column type normalises the bound
    parameter, so the comparison is correct on both SQLite and PostgreSQL.
    """
    return datetime.now(timezone.utc) - timedelta(days=days)


def _require(db: Session, model: Any, object_id: int, label: str):
    """Fetch by primary key or raise a clean 404."""
    instance = db.get(model, object_id)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")
    return instance


def _ensure_owner_email(email: str) -> None:
    if normalise_email(email) == normalise_email(settings.admin_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The owner account cannot be modified or removed.",
        )


def _auto_thumbnail(video_id: Optional[str], thumbnail: Optional[str], token: str, title: str) -> Optional[str]:
    """Use the supplied thumbnail, else derive it from the YouTube video id."""
    if thumbnail:
        return thumbnail
    if video_id:
        return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
    return artwork_url(token, label=title[:36], palette="walnut")


# --------------------------------------------------------------------------- #
# 1. Dashboard analytics                                                       #
# --------------------------------------------------------------------------- #
@router.get("/stats", response_model=AdminStats, summary="Admin dashboard analytics")
def stats(db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> AdminStats:
    """Counters, most-engaged resources and a live activity feed."""
    counters = Counters(
        users=int(db.execute(select(func.count(User.id))).scalar_one()),
        admins=int(
            db.execute(select(func.count(User.id)).where(User.role == UserRole.ADMIN.value)).scalar_one()
        ),
        new_users_last_7_days=int(
            db.execute(select(func.count(User.id)).where(User.created_at >= _cutoff(7))).scalar_one()
        ),
        shelves=int(db.execute(select(func.count(Shelf.id))).scalar_one()),
        resources=int(db.execute(select(func.count(Resource.id))).scalar_one()),
        books=int(db.execute(select(func.count(Book.id))).scalar_one()),
        labs=int(db.execute(select(func.count(Item.id))).scalar_one()),
        posts=int(db.execute(select(func.count(BlogPost.id))).scalar_one()),
        drafts=int(
            db.execute(
                select(func.count(BlogPost.id)).where(BlogPost.is_published.is_(False))
            ).scalar_one()
        )
        + int(
            db.execute(select(func.count(Book.id)).where(Book.is_published.is_(False))).scalar_one()
        )
        + int(
            db.execute(
                select(func.count(Item.id)).where(
                    Item.availability_status.in_(
                        [AvailabilityStatus.DRAFT.value, AvailabilityStatus.ARCHIVED.value]
                    )
                )
            ).scalar_one()
        ),
        progress_entries=int(db.execute(select(func.count(ProgressEntry.id))).scalar_one()),
        completions=int(
            db.execute(
                select(func.count(ProgressEntry.id)).where(
                    ProgressEntry.status == ProgressStatus.COMPLETED.value
                )
            ).scalar_one()
        ),
        book_downloads=int(db.execute(select(func.coalesce(func.sum(Book.download_count), 0))).scalar_one()),
        post_views=int(db.execute(select(func.coalesce(func.sum(BlogPost.view_count), 0))).scalar_one()),
    )

    # --- Most engaged resources -------------------------------------------
    grouped = (
        db.execute(
            select(
                ProgressEntry.resource_type,
                ProgressEntry.resource_id,
                func.max(ProgressEntry.resource_title).label("title"),
                func.count(ProgressEntry.id).label("engaged"),
                func.sum(
                    case((ProgressEntry.status == ProgressStatus.COMPLETED.value, 1), else_=0)
                ).label("completed"),
            )
            .group_by(ProgressEntry.resource_type, ProgressEntry.resource_id)
            .order_by(func.count(ProgressEntry.id).desc())
            .limit(6)
        )
        .all()
    )
    top_resources = [
        TopResource(
            resource_type=row.resource_type,
            resource_id=row.resource_id,
            title=row.title or "Untitled",
            engaged=int(row.engaged or 0),
            completed=int(row.completed or 0),
        )
        for row in grouped
    ]

    # --- Recent activity ----------------------------------------------------
    activity_rows = (
        db.execute(
            select(ProgressEntry, User.full_name)
            .join(User, User.id == ProgressEntry.user_id)
            .order_by(ProgressEntry.last_accessed_at.desc())
            .limit(10)
        )
        .all()
    )
    recent_activity = [
        AdminActivityRow(
            id=entry.id,
            user_id=entry.user_id,
            user_name=name,
            resource_type=entry.resource_type,
            title=entry.resource_title,
            status=entry.status,
            progress_percent=entry.progress_percent,
            at=entry.last_accessed_at,
        )
        for entry, name in activity_rows
    ]

    logger.info("Admin %s requested stats", admin.email)
    return AdminStats(counters=counters, top_resources=top_resources, recent_activity=recent_activity)


# --------------------------------------------------------------------------- #
# 2. People                                                                    #
# --------------------------------------------------------------------------- #
def _person_row(db: Session, user: User) -> AdminPersonRow:
    progress_count = int(
        db.execute(
            select(func.count(ProgressEntry.id)).where(ProgressEntry.user_id == user.id)
        ).scalar_one()
    )
    completed_count = int(
        db.execute(
            select(func.count(ProgressEntry.id)).where(
                ProgressEntry.user_id == user.id,
                ProgressEntry.status == ProgressStatus.COMPLETED.value,
            )
        ).scalar_one()
    )
    return AdminPersonRow(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        progress_count=progress_count,
        completed_count=completed_count,
    )


@router.get("/people", response_model=List[AdminPersonRow], summary="All accounts")
def people(
    search: Optional[str] = Query(default=None, max_length=80),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> List[AdminPersonRow]:
    statement = select(User).order_by(User.created_at.desc())
    if search:
        like = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(func.lower(User.email).like(like), func.lower(User.full_name).like(like))
        )
    return [_person_row(db, user) for user in db.execute(statement).scalars().all()]


@router.patch("/people/{user_id}/role", response_model=AdminPersonRow, summary="Change a role")
def change_role(
    user_id: int,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminPersonRow:
    user = _require(db, User, user_id, "User")
    _ensure_owner_email(user.email)
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own role."
        )
    if payload.role == UserRole.ADMIN.value:
        other_admins = int(
            db.execute(
                select(func.count(User.id)).where(
                    User.role == UserRole.ADMIN.value, User.id != user.id
                )
            ).scalar_one()
        )
        if other_admins == 0:  # pragma: no cover - defensive
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="At least one administrator must remain."
            )
    user.role = payload.role
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Admin %s set role=%s for user id=%s", admin.email, payload.role, user_id)
    return _person_row(db, user)


@router.patch("/people/{user_id}/active", response_model=AdminPersonRow, summary="Activate / deactivate")
def change_active(
    user_id: int,
    payload: ActiveUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminPersonRow:
    user = _require(db, User, user_id, "User")
    _ensure_owner_email(user.email)
    if user.id == admin.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account."
        )
    user.is_active = payload.is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Admin %s set active=%s for user id=%s", admin.email, payload.is_active, user_id)
    return _person_row(db, user)


@router.delete(
    "/people/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete an account"
)
def delete_person(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> None:
    user = _require(db, User, user_id, "User")
    _ensure_owner_email(user.email)
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account."
        )
    db.delete(user)
    db.commit()
    logger.info("Admin %s deleted user id=%s", admin.email, user_id)


# --------------------------------------------------------------------------- #
# 3. Shelves                                                                   #
# --------------------------------------------------------------------------- #
@router.get("/shelves", response_model=List[ShelfSummary], summary="All shelves (incl. drafts)")
def list_shelves(
    db: Session = Depends(get_db), _admin: User = Depends(require_admin)
) -> List[ShelfSummary]:
    shelves = db.execute(select(Shelf).order_by(Shelf.sort_order, Shelf.id)).scalars().all()
    result: List[ShelfSummary] = []
    for shelf in shelves:
        payload = ShelfSummary.model_validate(shelf)
        payload.resource_count = len(shelf.resources)
        result.append(payload)
    return result


def _shelf_out(db: Session, shelf: Shelf, *, include_unpublished: bool = True) -> ShelfOut:
    payload = ShelfOut.model_validate(shelf)
    payload.resources = [
        ResourceOut.model_validate(resource)
        for resource in sorted(shelf.resources, key=lambda item: (item.sort_order, item.id))
        if include_unpublished or resource.is_published
    ]
    return payload


@router.get("/shelves/{shelf_id}", response_model=ShelfOut, summary="Shelf with every card")
def get_shelf_admin(
    shelf_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ShelfOut:
    """Admin view of one shelf: includes unpublished cards (the public route hides them)."""
    shelf = _require(db, Shelf, shelf_id, "Shelf")
    return _shelf_out(db, shelf, include_unpublished=True)


@router.post("/shelves", response_model=ShelfOut, status_code=status.HTTP_201_CREATED, summary="Create a shelf")
def create_shelf(
    payload: ShelfCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ShelfOut:
    data = payload.model_dump(exclude={"resources"})
    data["slug"] = payload.slug or unique_slug(db, Shelf, payload.title)
    if db.execute(select(Shelf.id).where(Shelf.slug == data["slug"])).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Slug '{data['slug']}' is already used"
        )

    shelf = Shelf(**data)
    db.add(shelf)
    db.flush()

    for index, resource_payload in enumerate(payload.resources):
        resource_data = resource_payload.model_dump()
        resource_data["thumbnail_url"] = _auto_thumbnail(
            resource_data.get("video_id"),
            resource_data.get("thumbnail_url"),
            f"{shelf.slug}-{index + 1}",
            resource_data["title"],
        )
        resource_data.setdefault("sort_order", index + 1)
        db.add(Resource(shelf_id=shelf.id, **resource_data))

    db.commit()
    db.refresh(shelf)
    logger.info("Admin %s created shelf %s", admin.email, shelf.slug)
    return _shelf_out(db, shelf)


@router.patch("/shelves/{shelf_id}", response_model=ShelfOut, summary="Update a shelf")
def update_shelf(
    shelf_id: int,
    payload: ShelfUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ShelfOut:
    shelf = _require(db, Shelf, shelf_id, "Shelf")
    updates = payload.model_dump(exclude_unset=True)
    if "slug" in updates and updates["slug"] != shelf.slug:
        new_slug = updates["slug"] or unique_slug(db, Shelf, shelf.title, exclude_id=shelf.id)
        clash = db.execute(
            select(Shelf.id).where(Shelf.slug == new_slug, Shelf.id != shelf.id)
        ).first()
        if clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=f"Slug '{new_slug}' is already used"
            )
        updates["slug"] = new_slug

    for field, value in updates.items():
        setattr(shelf, field, value)
    db.add(shelf)
    db.commit()
    db.refresh(shelf)
    logger.info("Admin %s updated shelf id=%s", admin.email, shelf_id)
    return _shelf_out(db, shelf)


@router.delete("/shelves/{shelf_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a shelf")
def delete_shelf(
    shelf_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> None:
    shelf = _require(db, Shelf, shelf_id, "Shelf")
    db.delete(shelf)  # resources cascade
    db.commit()
    logger.info("Admin %s deleted shelf id=%s", admin.email, shelf_id)


# --------------------------------------------------------------------------- #
# 4. Shelf resources (videos / playlists)                                      #
# --------------------------------------------------------------------------- #
@router.post(
    "/resources", response_model=ResourceOut, status_code=status.HTTP_201_CREATED, summary="Add a card"
)
def create_resource(
    payload: ResourceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ResourceOut:
    shelf = _require(db, Shelf, payload.shelf_id, "Shelf")
    data = payload.model_dump(exclude={"shelf_id"})
    data["thumbnail_url"] = _auto_thumbnail(
        data.get("video_id"), data.get("thumbnail_url"), f"{shelf.slug}-new", data["title"]
    )
    resource = Resource(shelf_id=shelf.id, **data)
    db.add(resource)
    db.commit()
    db.refresh(resource)
    logger.info("Admin %s added resource %r to shelf %s", admin.email, resource.title, shelf.slug)
    return ResourceOut.model_validate(resource)


@router.patch("/resources/{resource_id}", response_model=ResourceOut, summary="Update a card")
def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ResourceOut:
    resource = _require(db, Resource, resource_id, "Resource")
    updates = payload.model_dump(exclude_unset=True)

    if "shelf_id" in updates and updates["shelf_id"] != resource.shelf_id:
        _require(db, Shelf, updates["shelf_id"], "Shelf")

    for field, value in updates.items():
        setattr(resource, field, value)

    # Thumbnail rules when either field changes:
    #   1. an explicit thumbnail always wins;
    #   2. otherwise follow the YouTube id (so swapping the video swaps the art);
    #   3. with no id at all, fall back to generated artwork.
    if {"video_id", "thumbnail_url"} & set(updates):
        explicit_thumbnail = updates.get("thumbnail_url")
        if explicit_thumbnail:
            resource.thumbnail_url = explicit_thumbnail
        elif resource.video_id:
            resource.thumbnail_url = f"https://img.youtube.com/vi/{resource.video_id}/hqdefault.jpg"
        else:
            resource.thumbnail_url = artwork_url(
                f"resource-{resource.id}", label=resource.title[:36], palette="walnut"
            )

    db.add(resource)
    db.commit()
    db.refresh(resource)
    logger.info("Admin %s updated resource id=%s", admin.email, resource_id)
    return ResourceOut.model_validate(resource)


@router.delete(
    "/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a card"
)
def delete_resource(
    resource_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> None:
    resource = _require(db, Resource, resource_id, "Resource")
    db.delete(resource)
    db.commit()
    logger.info("Admin %s deleted resource id=%s", admin.email, resource_id)


# --------------------------------------------------------------------------- #
# 5. Books                                                                     #
# --------------------------------------------------------------------------- #
@router.get("/books", response_model=List[BookOut], summary="All books (incl. drafts)")
def list_books_admin(
    db: Session = Depends(get_db), _admin: User = Depends(require_admin)
) -> List[BookOut]:
    books = db.execute(select(Book).order_by(Book.sort_order, Book.id)).scalars().all()
    return [BookOut.model_validate(book) for book in books]


@router.post("/books", response_model=BookOut, status_code=status.HTTP_201_CREATED, summary="Add a book")
def create_book(
    payload: BookCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> BookOut:
    data = payload.model_dump(exclude={"table_of_contents"})
    data["table_of_contents"] = [entry.model_dump() for entry in payload.table_of_contents]
    data["slug"] = payload.slug or unique_slug(db, Book, payload.title)
    if db.execute(select(Book.id).where(Book.slug == data["slug"])).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Slug '{data['slug']}' is already used"
        )
    data["cover_url"] = payload.cover_url or artwork_url(
        f"book-{data['slug']}", label=payload.title[:34], palette="chocolate"
    )
    data["file_url"] = payload.file_url or f"/api/books/{data['slug']}/download"

    book = Book(**data)
    db.add(book)
    db.commit()
    db.refresh(book)
    logger.info("Admin %s created book %s", admin.email, book.slug)
    return BookOut.model_validate(book)


@router.patch("/books/{book_id}", response_model=BookOut, summary="Update a book")
def update_book(
    book_id: int,
    payload: BookUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> BookOut:
    book = _require(db, Book, book_id, "Book")
    updates = payload.model_dump(exclude_unset=True)
    if "table_of_contents" in updates and updates["table_of_contents"] is not None:
        updates["table_of_contents"] = [dict(entry) for entry in updates["table_of_contents"]]
    if updates.get("slug") and updates["slug"] != book.slug:
        clash = db.execute(
            select(Book.id).where(Book.slug == updates["slug"], Book.id != book.id)
        ).first()
        if clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Slug '{updates['slug']}' is already used",
            )
        book.file_url = f"/api/books/{updates['slug']}/download"

    for field, value in updates.items():
        setattr(book, field, value)
    db.add(book)
    db.commit()
    db.refresh(book)
    logger.info("Admin %s updated book id=%s", admin.email, book_id)
    return BookOut.model_validate(book)


@router.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a book")
def delete_book(
    book_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> None:
    book = _require(db, Book, book_id, "Book")
    db.delete(book)
    db.commit()
    logger.info("Admin %s deleted book id=%s", admin.email, book_id)


# --------------------------------------------------------------------------- #
# 6. Labs (Item model)                                                         #
# --------------------------------------------------------------------------- #
@router.get("/labs", response_model=List[ItemOut], summary="All labs")
def list_labs_admin(
    db: Session = Depends(get_db), _admin: User = Depends(require_admin)
) -> List[ItemOut]:
    items = db.execute(select(Item).order_by(Item.sort_order, Item.id)).scalars().all()
    return [ItemOut.model_validate(item) for item in items]


@router.post("/labs", response_model=ItemOut, status_code=status.HTTP_201_CREATED, summary="Add a lab")
def create_lab(
    payload: ItemCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ItemOut:
    data = payload.model_dump()
    data["slug"] = payload.slug or unique_slug(db, Item, payload.title)
    if db.execute(select(Item.id).where(Item.slug == data["slug"])).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Slug '{data['slug']}' is already used"
        )
    data["gallery"] = [dict(entry) for entry in data.get("gallery") or []]
    data["image_url"] = payload.image_url or artwork_url(
        f"lab-{data['slug']}", label=payload.title[:32], palette="walnut"
    )

    item = Item(owner_id=admin.id, **data)
    db.add(item)
    db.commit()
    db.refresh(item)
    logger.info("Admin %s created lab %s", admin.email, item.slug)
    return ItemOut.model_validate(item)


@router.patch("/labs/{item_id}", response_model=ItemOut, summary="Update a lab")
def update_lab(
    item_id: int,
    payload: ItemUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ItemOut:
    item = _require(db, Item, item_id, "Lab")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("slug") and updates["slug"] != item.slug:
        clash = db.execute(
            select(Item.id).where(Item.slug == updates["slug"], Item.id != item.id)
        ).first()
        if clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Slug '{updates['slug']}' is already used",
            )
    if "gallery" in updates and updates["gallery"] is not None:
        updates["gallery"] = [dict(entry) for entry in updates["gallery"]]

    for field, value in updates.items():
        setattr(item, field, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    logger.info("Admin %s updated lab id=%s", admin.email, item_id)
    return ItemOut.model_validate(item)


@router.delete("/labs/{item_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a lab")
def delete_lab(
    item_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> None:
    item = _require(db, Item, item_id, "Lab")
    db.delete(item)
    db.commit()
    logger.info("Admin %s deleted lab id=%s", admin.email, item_id)


# --------------------------------------------------------------------------- #
# 7. Blog posts                                                                #
# --------------------------------------------------------------------------- #
@router.get("/posts", response_model=List[BlogPostOut], summary="All posts (incl. drafts)")
def list_posts_admin(
    db: Session = Depends(get_db), _admin: User = Depends(require_admin)
) -> List[BlogPostOut]:
    posts = (
        db.execute(
            select(BlogPost).order_by(BlogPost.published_at.desc().nulls_last(), BlogPost.id.desc())
        )
        .scalars()
        .all()
    )
    return [BlogPostOut.model_validate(post) for post in posts]


@router.post("/posts", response_model=BlogPostOut, status_code=status.HTTP_201_CREATED, summary="Write a post")
def create_post(
    payload: BlogPostCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> BlogPostOut:
    data = payload.model_dump()
    data["slug"] = payload.slug or unique_slug(db, BlogPost, payload.title)
    if db.execute(select(BlogPost.id).where(BlogPost.slug == data["slug"])).first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Slug '{data['slug']}' is already used"
        )
    data["cover_image"] = payload.cover_image or artwork_url(
        f"post-{data['slug']}", label=payload.title[:30], palette="latte"
    )
    if payload.is_published:
        data["published_at"] = datetime.now(timezone.utc)

    post = BlogPost(author_id=admin.id, **data)
    db.add(post)
    db.commit()
    db.refresh(post)
    logger.info("Admin %s created post %s", admin.email, post.slug)
    return BlogPostOut.model_validate(post)


@router.patch("/posts/{post_id}", response_model=BlogPostOut, summary="Update a post")
def update_post(
    post_id: int,
    payload: BlogPostUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> BlogPostOut:
    post = _require(db, BlogPost, post_id, "Post")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("slug") and updates["slug"] != post.slug:
        clash = db.execute(
            select(BlogPost.id).where(BlogPost.slug == updates["slug"], BlogPost.id != post.id)
        ).first()
        if clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Slug '{updates['slug']}' is already used",
            )
    # Publishing a draft for the first time stamps it now.
    if updates.get("is_published") and post.published_at is None:
        post.published_at = datetime.now(timezone.utc)

    for field, value in updates.items():
        setattr(post, field, value)
    db.add(post)
    db.commit()
    db.refresh(post)
    logger.info("Admin %s updated post id=%s", admin.email, post_id)
    return BlogPostOut.model_validate(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None, summary="Delete a post")
def delete_post(
    post_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
) -> None:
    post = _require(db, BlogPost, post_id, "Post")
    db.delete(post)
    db.commit()
    logger.info("Admin %s deleted post id=%s", admin.email, post_id)


# --------------------------------------------------------------------------- #
# 8. Site content (hero + About)                                               #
# --------------------------------------------------------------------------- #
@router.get("/site-content", summary="Editable landing copy")
def site_content(
    db: Session = Depends(get_db), _admin: User = Depends(require_admin)
) -> Dict[str, Any]:
    """Return the raw hero + about JSON so the admin form can pre-fill."""
    return {
        "hero": get_setting(db, HERO_KEY, DEFAULT_HERO),
        "about": get_setting(db, ABOUT_KEY, DEFAULT_ABOUT),
    }


@router.put("/site-content/hero", response_model=HeroContent, summary="Update hero copy")
def update_hero(
    payload: HeroContent,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> HeroContent:
    saved = set_setting(db, HERO_KEY, payload.model_dump())
    logger.info("Admin %s updated hero copy", admin.email)
    return HeroContent(**saved)


@router.put("/site-content/about", response_model=AboutOut, summary="Update the About block")
def update_about(
    payload: AboutOut,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AboutOut:
    saved = set_setting(db, ABOUT_KEY, payload.model_dump())
    logger.info("Admin %s updated about copy", admin.email)
    return AboutOut(**saved)


# --------------------------------------------------------------------------- #
# 9. Maintenance                                                               #
# --------------------------------------------------------------------------- #
@router.post("/reseed", summary="Re-seed empty collections")
def reseed(db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> Dict[str, Any]:
    """
    Re-run the content seeder.

    It is safe to call at any time: every seed function checks whether its table
    already has rows and does nothing in that case, so existing content is never
    duplicated or overwritten.
    """
    summary = bootstrap_database(db, seed=True)
    logger.info("Admin %s triggered reseed: %s", admin.email, summary)
    return {"reseeded": summary, "note": "Only empty collections were populated."}


