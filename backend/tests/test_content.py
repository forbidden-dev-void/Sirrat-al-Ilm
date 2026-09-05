"""Content endpoints: home payload, shelves, books, labs, posts and media."""

from __future__ import annotations

from typing import Dict

from fastapi.testclient import TestClient


def test_content_requires_a_session(client: TestClient) -> None:
    for path in ("/api/content/home", "/api/shelves", "/api/books", "/api/labs", "/api/posts"):
        assert client.get(path).status_code == 401, path


def test_home_payload_is_complete(client: TestClient, seeded_home: Dict) -> None:
    assert seeded_home["site"]["app_name"] == "Sirrat al-Ilm"
    assert seeded_home["hero"]["title"] and seeded_home["hero"]["subtitle"]

    # Three shelves seeded, each with published resources.
    slugs = [shelf["slug"] for shelf in seeded_home["shelves"]]
    assert slugs == ["wisdom", "programming", "tools"]
    assert all(shelf["resources"] for shelf in seeded_home["shelves"])

    assert len(seeded_home["books"]) == 6
    assert len(seeded_home["labs"]) == 6
    assert len(seeded_home["posts"]) == 6
    assert seeded_home["stats"]["videos"] == sum(
        len(shelf["resources"]) for shelf in seeded_home["shelves"]
    )

    # About block drives the landing page's education/experience sections.
    about = seeded_home["about"]
    assert about["education"] and about["experience"]
    assert about["skills"] and about["socials"]


def test_every_seeded_video_has_a_clickable_target(seeded_home: Dict) -> None:
    for shelf in seeded_home["shelves"]:
        for resource in shelf["resources"]:
            assert resource["external_url"], resource["title"]
            assert resource["title"] and resource["description"]


def test_shelf_detail_and_unknown_slug(client: TestClient, admin_headers: Dict[str, str]) -> None:
    ok = client.get("/api/shelves/programming", headers=admin_headers)
    assert ok.status_code == 200
    body = ok.json()
    assert body["slug"] == "programming"
    assert body["kind"] == "programming"
    assert len(body["resources"]) >= 8

    missing = client.get("/api/shelves/does-not-exist", headers=admin_headers)
    assert missing.status_code == 404


def test_shelves_can_be_filtered_by_kind(client: TestClient, admin_headers: Dict[str, str]) -> None:
    response = client.get("/api/shelves", params={"kind": "wisdom"}, headers=admin_headers)
    assert response.status_code == 200
    assert [shelf["slug"] for shelf in response.json()] == ["wisdom"]


def test_book_detail_and_download(client: TestClient, admin_headers: Dict[str, str]) -> None:
    detail = client.get("/api/books/the-quiet-code", headers=admin_headers)
    assert detail.status_code == 200
    book = detail.json()
    assert book["is_free"] is True
    assert book["table_of_contents"]

    before = book["download_count"]
    download = client.get("/api/books/the-quiet-code/download", headers=admin_headers)
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/pdf"
    assert "attachment" in download.headers["content-disposition"]

    pdf = download.content
    # A real PDF: magic header, xref table and EOF marker.
    assert pdf.startswith(b"%PDF-1.4")
    assert b"\nxref\n" in pdf
    assert pdf.rstrip().endswith(b"%%EOF")
    assert len(pdf) > 1500

    after = client.get("/api/books/the-quiet-code", headers=admin_headers).json()["download_count"]
    assert after == before + 1


def test_book_download_records_progress(
    client: TestClient, new_user: Dict[str, object]
) -> None:
    headers = new_user["headers"]
    books = client.get("/api/books", headers=headers).json()  # type: ignore[arg-type]
    slug = books[0]["slug"]

    assert client.get(f"/api/books/{slug}/download", headers=headers).status_code == 200  # type: ignore[arg-type]

    entries = client.get(
        "/api/progress/entries", params={"resource_type": "book"}, headers=headers  # type: ignore[arg-type]
    ).json()
    assert any(entry["resource_title"] == books[0]["title"] for entry in entries)


def test_books_search_and_category_filter(client: TestClient, admin_headers: Dict[str, str]) -> None:
    search = client.get("/api/books", params={"search": "python"}, headers=admin_headers)
    assert search.status_code == 200
    assert any("Python" in book["title"] for book in search.json())

    filtered = client.get("/api/books", params={"category": "religion"}, headers=admin_headers)
    assert all(book["category"] == "Religion" for book in filtered.json())


def test_lab_detail_includes_gallery_and_records_progress(
    client: TestClient, new_user: Dict[str, object]
) -> None:
    headers = new_user["headers"]
    labs = client.get("/api/labs", headers=headers).json()  # type: ignore[arg-type]
    assert labs

    slug = labs[0]["slug"]
    detail = client.get(f"/api/labs/{slug}", headers=headers)  # type: ignore[arg-type]
    assert detail.status_code == 200
    body = detail.json()
    assert body["description"]
    assert body["gallery"], "labs must ship gallery placeholders"
    assert all(entry.get("url") for entry in body["gallery"])

    progress = client.get(
        "/api/progress/entries", params={"resource_type": "lab"}, headers=headers  # type: ignore[arg-type]
    ).json()
    assert any(entry["resource_slug"] == slug for entry in progress)


def test_post_detail_increments_views(client: TestClient, admin_headers: Dict[str, str]) -> None:
    posts = client.get("/api/posts", headers=admin_headers).json()
    slug = posts[0]["slug"]

    first = client.get(f"/api/posts/{slug}", headers=admin_headers).json()
    second = client.get(f"/api/posts/{slug}", headers=admin_headers).json()
    assert second["view_count"] == first["view_count"] + 1
    assert second["body"]


def test_posts_category_filter(client: TestClient, admin_headers: Dict[str, str]) -> None:
    response = client.get("/api/posts", params={"category": "programming"}, headers=admin_headers)
    assert response.status_code == 200
    assert response.json()
    assert all(post["category"] == "programming" for post in response.json())

    invalid = client.get("/api/posts", params={"category": "nonsense"}, headers=admin_headers)
    assert invalid.status_code == 422


def test_generated_artwork_is_public_and_cacheable(client: TestClient) -> None:
    response = client.get("/api/media/art/lab-demo.svg", params={"label": "Demo Lab"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert "max-age" in response.headers["cache-control"]
    assert response.text.startswith("<svg")
    assert "Demo Lab" in response.text

    # Deterministic: the same token always renders the same artwork.
    again = client.get("/api/media/art/lab-demo.svg", params={"label": "Demo Lab"})
    assert again.text == response.text


def test_unknown_api_path_returns_json_not_html(client: TestClient) -> None:
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json()["detail"] == "Not found"
