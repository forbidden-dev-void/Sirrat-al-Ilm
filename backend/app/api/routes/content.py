"""
Content routes (read side)
==========================

Everything the public-facing pages render:

GET /api/content/home        -> one aggregated payload for the landing page
GET /api/content/about       -> hero + About block (editable in Admin)
GET /api/shelves[/{slug}]    -> YouTube shelves and their cards
GET /api/books[/{slug}]      -> free books
GET /api/books/{slug}/download -> generated PDF (+ download counter)
GET /api/labs[/{slug}]       -> Lab listings (Item model)
GET /api/posts[/{slug}]      -> blog posts

All of these require a valid session because the whole site sits behind the
sign-in gate; only generated artwork (``/api/media/art``) is public.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_active_user
from app.db.session import get_db
from app.models.blog import BlogPost
from app.models.book import Book
from app.models.item import AvailabilityStatus, Item
from app.models.shelf import Resource, Shelf
from app.models.user import User
from app.schemas.blog import BlogPostOut, BlogPostSummary
from app.schemas.book import BookOut
from app.schemas.content import AboutOut, ContentStats, HeroContent, HomeOverview, SiteMeta
from app.schemas.item import ItemOut
from app.schemas.shelf import ResourceOut, ShelfOut
from app.services.pdf import build_book_pdf
from app.services.progress_service import snapshot_for, upsert_progress
from app.services.site_content import ABOUT_KEY, DEFAULT_ABOUT, DEFAULT_HERO, HERO_KEY, get_setting
from app.schemas.progress import ProgressUpsertRequest

logger = logging.getLogger("sirrat.content")

router = APIRouter(tags=["Content"])


# --------------------------------------------------------------------------- #
# Aggregated payloads                                                          #
# --------------------------------------------------------------------------- #
def _site_meta() -> SiteMeta:
    return SiteMeta(
        app_name=settings.app_name,
        tagline=settings.app_tagline,
        version=settings.app_version,
        owner=settings.site_owner,
        youtube_channel=settings.site_youtube_channel,
        contact_email=settings.site_contact_email,
    )


def _published_shelves(db: Session) -> List[ShelfOut]:
    """Published shelves with only their published resources, in shelf order."""
    shelves = (
        db.execute(
            select(Shelf).where(Shelf.is_published.is_(True)).order_by(Shelf.sort_order, Shelf.id)
        )
        .scalars()
        .all()
    )
    result: List[ShelfOut] = []
    for shelf in shelves:
        payload = ShelfOut.model_validate(shelf)
        payload.resources = [
            ResourceOut.model_validate(resource)
            for resource in sorted(shelf.resources, key=lambda item: (item.sort_order, item.id))
            if resource.is_published
        ]
        result.append(payload)
    return result


def _published_books(db: Session) -> List[BookOut]:
    books = (
        db.execute(
            select(Book).where(Book.is_published.is_(True)).order_by(Book.sort_order, Book.id)
        )
        .scalars()
        .all()
    )
    return [BookOut.model_validate(book) for book in books]


def _visible_labs(db: Session, *, include_drafts: bool = False) -> List[ItemOut]:
    statement = select(Item).order_by(Item.sort_order, Item.id)
    if not include_drafts:
        statement = statement.where(
            Item.availability_status.in_(
                [AvailabilityStatus.AVAILABLE.value, AvailabilityStatus.IN_PROGRESS.value]
            )
        )
    items = db.execute(statement).scalars().all()
    return [ItemOut.model_validate(item) for item in items]


def _latest_posts(db: Session, limit: int = 6) -> List[BlogPostSummary]:
    posts = (
        db.execute(
            select(BlogPost)
            .where(BlogPost.is_published.is_(True))
            .order_by(BlogPost.published_at.desc().nulls_last(), BlogPost.id.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return [BlogPostSummary.model_validate(post) for post in posts]


@router.get("/content/home", response_model=HomeOverview, summary="Landing page payload")
def home_overview(
    db: Session = Depends(get_db),
    _user: User = Depends(get_active_user),
) -> HomeOverview:
    """One request that fills the whole landing page (hero, shelves, books, labs, posts)."""
    shelves = _published_shelves(db)
    books = _published_books(db)
    labs = _visible_labs(db)
    posts = _latest_posts(db, limit=6)

    hero_raw = get_setting(db, HERO_KEY, DEFAULT_HERO)
    about_raw = get_setting(db, ABOUT_KEY, DEFAULT_ABOUT)

    return HomeOverview(
        site=_site_meta(),
        hero=HeroContent(**hero_raw),
        about=AboutOut(**about_raw),
        stats=ContentStats(
            shelves=len(shelves),
            videos=sum(len(shelf.resources) for shelf in shelves),
            books=len(books),
            labs=len(labs),
            posts=int(
                db.execute(
                    select(func.count(BlogPost.id)).where(BlogPost.is_published.is_(True))
                ).scalar_one()
            ),
        ),
        shelves=shelves,
        books=books,
        labs=labs,
        posts=posts,
    )


@router.get("/content/about", response_model=AboutOut, summary="About block")
def about(db: Session = Depends(get_db), _user: User = Depends(get_active_user)) -> AboutOut:
    return AboutOut(**get_setting(db, ABOUT_KEY, DEFAULT_ABOUT))


@router.get("/content/meta", response_model=SiteMeta, summary="Site branding")
def meta() -> SiteMeta:
    return _site_meta()


# --------------------------------------------------------------------------- #
# Shelves                                                                      #
# --------------------------------------------------------------------------- #
@router.get("/shelves", response_model=List[ShelfOut], summary="List published shelves")
def list_shelves(
    kind: Optional[str] = Query(default=None, description="Filter by shelf kind"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_active_user),
) -> List[ShelfOut]:
    shelves = _published_shelves(db)
    if kind:
        shelves = [shelf for shelf in shelves if shelf.kind == kind]
    return shelves


@router.get("/shelves/{slug}", response_model=ShelfOut, summary="One shelf with its cards")
def get_shelf(
    slug: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_active_user),
) -> ShelfOut:
    shelf = db.execute(select(Shelf).where(Shelf.slug == slug)).scalar_one_or_none()
    if shelf is None or not shelf.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shelf not found")
    payload = ShelfOut.model_validate(shelf)
    payload.resources = [
        ResourceOut.model_validate(resource)
        for resource in sorted(shelf.resources, key=lambda item: (item.sort_order, item.id))
        if resource.is_published
    ]
    return payload


@router.get("/resources/{resource_id}", response_model=ResourceOut, summary="One video card")
def get_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_active_user),
) -> ResourceOut:
    resource = db.get(Resource, resource_id)
    if resource is None or not resource.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return ResourceOut.model_validate(resource)


# --------------------------------------------------------------------------- #
# Books                                                                        #
# --------------------------------------------------------------------------- #
@router.get("/books", response_model=List[BookOut], summary="List published books")
def list_books(
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None, min_length=1, max_length=80),
    db: Session = Depends(get_db),
    _user: User = Depends(get_active_user),
) -> List[BookOut]:
    statement = select(Book).where(Book.is_published.is_(True))
    if category:
        statement = statement.where(func.lower(Book.category) == category.lower())
    if search:
        like = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(Book.title).like(like),
                func.lower(Book.subtitle).like(like),
                func.lower(Book.description).like(like),
            )
        )
    books = db.execute(statement.order_by(Book.sort_order, Book.id)).scalars().all()
    return [BookOut.model_validate(book) for book in books]


@router.get("/books/{slug}", response_model=BookOut, summary="Book detail")
def get_book(
    slug: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_active_user),
) -> BookOut:
    book = db.execute(select(Book).where(Book.slug == slug)).scalar_one_or_none()
    if book is None or not book.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return BookOut.model_validate(book)


@router.get("/books/{slug}/download", summary="Download the free PDF")
def download_book(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_active_user),
) -> Response:
    """
    Generate and stream the book PDF.

    Side effects (both intentional):
      * ``download_count`` is incremented for the admin dashboard
      * a progress row is written so the book shows up as "started" for the user
    """
    book = db.execute(select(Book).where(Book.slug == slug)).scalar_one_or_none()
    if book is None or not book.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    pdf_bytes = build_book_pdf(
        title=book.title,
        subtitle=book.subtitle,
        author=book.author,
        description=book.description,
        language=book.language,
        pages=book.pages,
        edition=book.edition,
        table_of_contents=book.table_of_contents or [],
    )

    book.download_count = (book.download_count or 0) + 1
    db.add(book)
    db.commit()

    upsert_progress(
        db,
        user,
        ProgressUpsertRequest(
            resource_type="book",
            resource_id=book.id,
            status="in_progress",
            progress_percent=5,
        ),
    )

    filename = f"{book.slug}.pdf"
    logger.info("Book download: %s by user id=%s", slug, user.id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --------------------------------------------------------------------------- #
# Labs (Item model)                                                            #
# --------------------------------------------------------------------------- #
@router.get("/labs", response_model=List[ItemOut], summary="List labs")
def list_labs(
    category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_active_user),
) -> List[ItemOut]:
    labs = _visible_labs(db)
    if category:
        labs = [lab for lab in labs if (lab.category or "").lower() == category.lower()]
    return labs


@router.get("/labs/{slug}", response_model=ItemOut, summary="Lab detail (gallery + description)")
def get_lab(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_active_user),
) -> ItemOut:
    item = db.execute(select(Item).where(Item.slug == slug)).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab not found")
    if item.availability_status == AvailabilityStatus.DRAFT.value and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab not found")

    # Opening a lab records an "explored" progress row for the dashboard.
    snapshot = snapshot_for(db, "lab", item.id)
    if snapshot is not None:
        upsert_progress(
            db,
            user,
            ProgressUpsertRequest(
                resource_type="lab", resource_id=item.id, progress_percent=15, status="in_progress"
            ),
        )
    return ItemOut.model_validate(item)


# --------------------------------------------------------------------------- #
# Blog                                                                         #
# --------------------------------------------------------------------------- #
@router.get("/posts", response_model=List[BlogPostSummary], summary="List blog posts")
def list_posts(
    category: Optional[str] = Query(default=None, pattern="^(religion|tech|life|programming|books)$"),
    search: Optional[str] = Query(default=None, min_length=1, max_length=80),
    limit: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_active_user),
) -> List[BlogPostSummary]:
    statement = select(BlogPost).where(BlogPost.is_published.is_(True))
    if category:
        statement = statement.where(BlogPost.category == category)
    if search:
        like = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(BlogPost.title).like(like),
                func.lower(BlogPost.excerpt).like(like),
                func.lower(BlogPost.body).like(like),
            )
        )
    posts = (
        db.execute(
            statement.order_by(BlogPost.published_at.desc().nulls_last(), BlogPost.id.desc()).limit(limit)
        )
        .scalars()
        .all()
    )
    return [BlogPostSummary.model_validate(post) for post in posts]


@router.get("/posts/{slug}", response_model=BlogPostOut, summary="Blog post detail")
def get_post(
    slug: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_active_user),
) -> BlogPostOut:
    post = db.execute(select(BlogPost).where(BlogPost.slug == slug)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if not post.is_published and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    post.view_count = (post.view_count or 0) + 1
    if post.published_at is None:
        post.published_at = datetime.now(timezone.utc)
    db.add(post)
    db.commit()
    db.refresh(post)

    upsert_progress(
        db,
        user,
        ProgressUpsertRequest(
            resource_type="blog", resource_id=post.id, progress_percent=100, status="completed"
        ),
    )
    return BlogPostOut.model_validate(post)
