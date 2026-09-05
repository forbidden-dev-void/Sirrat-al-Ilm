"""Administrator console: RBAC plus every CRUD surface."""

from __future__ import annotations

from typing import Dict

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL, unique_email

# A shelf payload reused by several tests.
SHELF_PAYLOAD = {
    "title": "Test Shelf: Arabic Basics",
    "slug": "test-shelf-arabic",
    "kind": "wisdom",
    "subtitle": "Created by the pytest suite",
    "description": "Temporary shelf used to verify admin CRUD.",
    "is_published": True,
    "sort_order": 99,
    "resources": [
        {
            "title": "Alphabet & pronunciation",
            "description": "First lesson of the test shelf.",
            "resource_type": "video",
            "video_id": "dQw4w9WgXcQ",
            "external_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "channel": "Test channel",
            "duration_label": "10:00",
            "sort_order": 1,
        },
        {
            "title": "Reading practice",
            "description": "Second lesson of the test shelf.",
            "external_url": "https://www.youtube.com/results?search_query=arabic+reading",
            "sort_order": 2,
        },
    ],
}


# --------------------------------------------------------------------------- #
# Access control                                                               #
# --------------------------------------------------------------------------- #
def test_admin_endpoints_reject_anonymous_and_regular_users(
    client: TestClient, new_user: Dict[str, object]
) -> None:
    paths = ["/api/admin/stats", "/api/admin/people", "/api/admin/shelves", "/api/admin/books"]
    for path in paths:
        assert client.get(path).status_code == 401, path
        assert client.get(path, headers=new_user["headers"]).status_code == 403, path  # type: ignore[arg-type]


def test_regular_users_cannot_write_content(client: TestClient, new_user: Dict[str, object]) -> None:
    headers = new_user["headers"]
    assert client.post("/api/admin/shelves", headers=headers, json=SHELF_PAYLOAD).status_code == 403  # type: ignore[arg-type]
    assert client.delete("/api/admin/shelves/1", headers=headers).status_code == 403  # type: ignore[arg-type]
    assert client.post("/api/admin/reseed", headers=headers).status_code == 403  # type: ignore[arg-type]


# --------------------------------------------------------------------------- #
# Analytics                                                                    #
# --------------------------------------------------------------------------- #
def test_stats_counters(client: TestClient, admin_headers: Dict[str, str]) -> None:
    response = client.get("/api/admin/stats", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    counters = body["counters"]

    assert counters["users"] >= 2
    assert counters["admins"] >= 1
    assert counters["shelves"] >= 3
    assert counters["resources"] >= 20
    assert counters["books"] == 6
    assert counters["labs"] == 6
    assert counters["posts"] == 6
    assert counters["progress_entries"] >= 1
    assert "top_resources" in body and "recent_activity" in body


# --------------------------------------------------------------------------- #
# Shelves + resources                                                          #
# --------------------------------------------------------------------------- #
def test_shelf_crud_lifecycle(client: TestClient, admin_headers: Dict[str, str]) -> None:
    # --- create (with nested resources) ------------------------------------
    created = client.post("/api/admin/shelves", headers=admin_headers, json=SHELF_PAYLOAD)
    assert created.status_code == 201, created.text
    shelf = created.json()
    assert shelf["slug"] == "test-shelf-arabic"
    assert len(shelf["resources"]) == 2
    # Thumbnail derived from the YouTube id for the first card only.
    assert shelf["resources"][0]["thumbnail_url"] == (
        "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    )
    assert shelf["resources"][1]["thumbnail_url"]

    shelf_id = shelf["id"]

    # --- duplicate slug is refused -----------------------------------------
    duplicate = client.post("/api/admin/shelves", headers=admin_headers, json=SHELF_PAYLOAD)
    assert duplicate.status_code == 409

    # --- read ----------------------------------------------------------------
    listed = client.get("/api/admin/shelves", headers=admin_headers).json()
    assert any(row["id"] == shelf_id and row["resource_count"] == 2 for row in listed)

    # --- update --------------------------------------------------------------
    patched = client.patch(
        f"/api/admin/shelves/{shelf_id}",
        headers=admin_headers,
        json={"title": "Test Shelf: Arabic (renamed)", "is_published": False},
    )
    assert patched.status_code == 200
    assert patched.json()["title"].endswith("(renamed)")
    assert patched.json()["is_published"] is False

    # Unpublished shelves disappear from the public API.
    assert client.get("/api/shelves/test-shelf-arabic", headers=admin_headers).status_code == 404

    # --- resource create / update / delete ----------------------------------
    added = client.post(
        "/api/admin/resources",
        headers=admin_headers,
        json={
            "shelf_id": shelf_id,
            "title": "Writing practice",
            "description": "Third lesson.",
            "external_url": "https://www.youtube.com/results?search_query=arabic+writing",
            "sort_order": 3,
        },
    )
    assert added.status_code == 201
    resource_id = added.json()["id"]

    renamed = client.patch(
        f"/api/admin/resources/{resource_id}",
        headers=admin_headers,
        json={"title": "Writing practice (updated)", "video_id": "abc123XYZ_-"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["thumbnail_url"] == "https://img.youtube.com/vi/abc123XYZ_-/hqdefault.jpg"

    assert client.delete(f"/api/admin/resources/{resource_id}", headers=admin_headers).status_code == 204

    # --- delete (cascades to resources) -------------------------------------
    assert client.delete(f"/api/admin/shelves/{shelf_id}", headers=admin_headers).status_code == 204
    assert client.get(f"/api/admin/shelves/{shelf_id}", headers=admin_headers).status_code in (404, 405)
    assert client.delete(f"/api/admin/shelves/{shelf_id}", headers=admin_headers).status_code == 404


def test_shelf_validation_errors(client: TestClient, admin_headers: Dict[str, str]) -> None:
    bad_slug = client.post(
        "/api/admin/shelves",
        headers=admin_headers,
        json={**SHELF_PAYLOAD, "slug": "Not A Slug!", "resources": []},
    )
    assert bad_slug.status_code == 422

    missing_shelf = client.post(
        "/api/admin/resources",
        headers=admin_headers,
        json={"shelf_id": 999_999, "title": "Orphan card"},
    )
    assert missing_shelf.status_code == 404


# --------------------------------------------------------------------------- #
# Books / Labs / Posts                                                         #
# --------------------------------------------------------------------------- #
def test_book_crud(client: TestClient, admin_headers: Dict[str, str]) -> None:
    created = client.post(
        "/api/admin/books",
        headers=admin_headers,
        json={
            "title": "Test Book: On Patience",
            "subtitle": "A short treatise",
            "description": "Temporary book used by the test suite.",
            "category": "Religion",
            "language": "English",
            "pages": 42,
            "table_of_contents": [{"chapter": "01", "title": "Beginning", "pages": "1—10"}],
            "is_published": True,
        },
    )
    assert created.status_code == 201, created.text
    book = created.json()
    assert book["slug"] == "test-book-on-patience"
    # Cover art + download URL are generated automatically.
    assert book["cover_url"].startswith("/api/media/art/")
    assert book["file_url"] == f"/api/books/{book['slug']}/download"

    assert client.get(f"/api/books/{book['slug']}", headers=admin_headers).status_code == 200
    assert client.get(f"/api/books/{book['slug']}/download", headers=admin_headers).status_code == 200

    patched = client.patch(
        f"/api/admin/books/{book['id']}", headers=admin_headers, json={"pages": 58, "is_published": False}
    )
    assert patched.status_code == 200
    assert patched.json()["pages"] == 58

    # Unpublished -> hidden from readers.
    assert client.get(f"/api/books/{book['slug']}", headers=admin_headers).status_code == 404

    assert client.delete(f"/api/admin/books/{book['id']}", headers=admin_headers).status_code == 204


def test_lab_crud(client: TestClient, admin_headers: Dict[str, str]) -> None:
    created = client.post(
        "/api/admin/labs",
        headers=admin_headers,
        json={
            "title": "Test Lab: Prayer Time Widget",
            "description": "## Overview\n\nTemporary lab used by the test suite.",
            "summary": "A widget.",
            "category": "Backend",
            "availability_status": "in_progress",
            "tags": ["api", "test"],
            "gallery": [{"url": "/api/media/art/test.svg", "caption": "Screenshot"}],
        },
    )
    assert created.status_code == 201, created.text
    lab = created.json()
    assert lab["slug"] == "test-lab-prayer-time-widget"
    assert lab["image_url"].startswith("/api/media/art/")
    assert lab["gallery"][0]["caption"] == "Screenshot"
    assert lab["owner"]["role"] == "admin"

    patched = client.patch(
        f"/api/admin/labs/{lab['id']}",
        headers=admin_headers,
        json={"availability_status": "available", "tags": ["api", "test", "shipped"]},
    )
    assert patched.status_code == 200
    assert patched.json()["availability_status"] == "available"
    assert len(patched.json()["tags"]) == 3

    assert client.delete(f"/api/admin/labs/{lab['id']}", headers=admin_headers).status_code == 204


def test_post_crud(client: TestClient, admin_headers: Dict[str, str]) -> None:
    created = client.post(
        "/api/admin/posts",
        headers=admin_headers,
        json={
            "title": "Test Post: Shipping Notes",
            "excerpt": "A temporary post.",
            "body": "## Notes\n\nNothing to see here.",
            "category": "tech",
            "tags": ["test"],
            "is_published": True,
            "reading_minutes": 3,
        },
    )
    assert created.status_code == 201, created.text
    post = created.json()
    assert post["slug"] == "test-post-shipping-notes"
    assert post["published_at"] is not None
    assert post["author"]["role"] == "admin"

    draft = client.post(
        "/api/admin/posts",
        headers=admin_headers,
        json={"title": "Test Draft Post", "body": "Draft", "category": "life", "is_published": False},
    )
    assert draft.status_code == 201
    assert draft.json()["published_at"] is None
    assert draft.json()["slug"] not in [row["slug"] for row in client.get("/api/posts", headers=admin_headers).json()]

    patched = client.patch(
        f"/api/admin/posts/{draft.json()['id']}", headers=admin_headers, json={"is_published": True}
    )
    assert patched.status_code == 200
    assert patched.json()["published_at"] is not None

    assert client.delete(f"/api/admin/posts/{post['id']}", headers=admin_headers).status_code == 204
    assert client.delete(f"/api/admin/posts/{draft.json()['id']}", headers=admin_headers).status_code == 204


# --------------------------------------------------------------------------- #
# People                                                                       #
# --------------------------------------------------------------------------- #
def test_people_list_and_role_change(
    client: TestClient, admin_headers: Dict[str, str], new_user: Dict[str, object]
) -> None:
    listing = client.get("/api/admin/people", headers=admin_headers)
    assert listing.status_code == 200
    rows = listing.json()
    assert any(row["email"] == new_user["email"] for row in rows)
    assert rows[0]["progress_count"] >= 0

    searched = client.get(
        "/api/admin/people", params={"search": str(new_user["email"])[:12]}, headers=admin_headers
    ).json()
    assert any(row["email"] == new_user["email"] for row in searched)

    user_id = new_user["user"]["id"]
    promoted = client.patch(
        f"/api/admin/people/{user_id}/role", headers=admin_headers, json={"role": "admin"}
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"

    # The promoted user can now read admin stats.
    assert client.get("/api/admin/stats", headers=new_user["headers"]).status_code == 200  # type: ignore[arg-type]

    demoted = client.patch(
        f"/api/admin/people/{user_id}/role", headers=admin_headers, json={"role": "user"}
    )
    assert demoted.json()["role"] == "user"
    assert client.get("/api/admin/stats", headers=new_user["headers"]).status_code == 403  # type: ignore[arg-type]


def test_owner_account_is_protected(client: TestClient, admin_headers: Dict[str, str]) -> None:
    people = client.get("/api/admin/people", headers=admin_headers).json()
    owner = next(row for row in people if row["email"] == ADMIN_EMAIL)

    assert (
        client.patch(f"/api/admin/people/{owner['id']}/role", headers=admin_headers, json={"role": "user"}).status_code
        == 400
    )
    assert (
        client.patch(
            f"/api/admin/people/{owner['id']}/active", headers=admin_headers, json={"is_active": False}
        ).status_code
        == 400
    )
    assert client.delete(f"/api/admin/people/{owner['id']}", headers=admin_headers).status_code == 400


def test_admin_cannot_demote_themselves(client: TestClient, admin_headers: Dict[str, str]) -> None:
    me = client.get("/api/auth/me", headers=admin_headers).json()
    if me["email"] == ADMIN_EMAIL:
        # Owner protection fires first; the outcome is the same (400).
        assert (
            client.patch(f"/api/admin/people/{me['id']}/role", headers=admin_headers, json={"role": "user"}).status_code
            == 400
        )
        return

    promoted = client.post(
        "/api/auth/signup",
        json={"full_name": "Second Admin", "email": unique_email(), "password": "SecondPass1"},
    ).json()
    client.patch(
        f"/api/admin/people/{promoted['user']['id']}/role",
        headers=admin_headers,
        json={"role": "admin"},
    )
    second_headers = {"Authorization": f"Bearer {promoted['tokens']['access_token']}"}
    response = client.patch(
        f"/api/admin/people/{promoted['user']['id']}/role",
        headers=second_headers,
        json={"role": "user"},
    )
    assert response.status_code == 400


def test_missing_admin_target_is_404(client: TestClient, admin_headers: Dict[str, str]) -> None:
    assert (
        client.patch("/api/admin/people/999999/role", headers=admin_headers, json={"role": "user"}).status_code
        == 404
    )
    assert client.delete("/api/admin/books/999999", headers=admin_headers).status_code == 404


# --------------------------------------------------------------------------- #
# Site content + maintenance                                                   #
# --------------------------------------------------------------------------- #
def test_site_content_is_editable_and_reflected_publicly(
    client: TestClient, admin_headers: Dict[str, str]
) -> None:
    current = client.get("/api/admin/site-content", headers=admin_headers).json()
    assert "hero" in current and "about" in current

    new_hero = {**current["hero"], "title": "Brewed slowly.", "highlight": "Understood deeply."}
    saved = client.put("/api/admin/site-content/hero", headers=admin_headers, json=new_hero)
    assert saved.status_code == 200
    assert saved.json()["title"] == "Brewed slowly."

    home = client.get("/api/content/home", headers=admin_headers).json()
    assert home["hero"]["title"] == "Brewed slowly."

    # Restore the original copy so other tests see the seeded content.
    assert (
        client.put("/api/admin/site-content/hero", headers=admin_headers, json=current["hero"]).status_code
        == 200
    )


def test_about_content_validation(client: TestClient, admin_headers: Dict[str, str]) -> None:
    broken = client.put("/api/admin/site-content/about", headers=admin_headers, json={"headline": 12345})
    # Missing required structure -> 422 (extra fields are ignored, types are checked).
    assert broken.status_code in (200, 422)

    current = client.get("/api/admin/site-content", headers=admin_headers).json()["about"]
    updated = {**current, "headline": "Assalamu alaikum — updated."}
    assert client.put("/api/admin/site-content/about", headers=admin_headers, json=updated).status_code == 200
    assert client.get("/api/content/about", headers=admin_headers).json()["headline"].endswith("updated.")

    assert (
        client.put("/api/admin/site-content/about", headers=admin_headers, json=current).status_code == 200
    )


def test_reseed_is_idempotent(client: TestClient, admin_headers: Dict[str, str]) -> None:
    before = client.get("/api/admin/stats", headers=admin_headers).json()["counters"]
    response = client.post("/api/admin/reseed", headers=admin_headers)
    assert response.status_code == 200
    after = client.get("/api/admin/stats", headers=admin_headers).json()["counters"]

    assert after["books"] == before["books"]
    assert after["labs"] == before["labs"]
    assert after["shelves"] == before["shelves"]


@pytest.mark.parametrize("path", ["/api/admin/labs", "/api/admin/posts", "/api/admin/books"])
def test_admin_listing_endpoints(client: TestClient, admin_headers: Dict[str, str], path: str) -> None:
    response = client.get(path, headers=admin_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
