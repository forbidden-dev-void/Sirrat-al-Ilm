"""
Security & utility unit tests
=============================

Covers the pieces that must never silently break: password hashing, JWT
validation, slug generation, the PDF writer and the SPA path-traversal guard.
"""

from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    is_valid_email,
    normalise_email,
    password_needs_rehash,
    password_policy_violation,
    verify_password,
)
from app.services.art import build_artwork_svg
from app.services.pdf import build_book_pdf
from app.services.slug import slugify


# --------------------------------------------------------------------------- #
# Passwords                                                                    #
# --------------------------------------------------------------------------- #
def test_password_hash_roundtrip() -> None:
    stored = hash_password("Str0ngPass")
    assert stored.startswith("pbkdf2_sha256$")
    assert verify_password("Str0ngPass", stored) is True
    assert verify_password("str0ngpass", stored) is False


def test_password_hashes_are_salted() -> None:
    first = hash_password("SamePassword1")
    second = hash_password("SamePassword1")
    assert first != second
    assert verify_password("SamePassword1", first)
    assert verify_password("SamePassword1", second)


def test_verify_rejects_malformed_hashes() -> None:
    for broken in ("", "nonsense", "pbkdf2_sha256$abc$def", "bcrypt$12$x$y"):
        assert verify_password("Whatever1", broken) is False


def test_rehash_detection() -> None:
    cheap = hash_password("Str0ngPass", iterations=10)
    assert password_needs_rehash(cheap) is True
    assert password_needs_rehash(hash_password("Str0ngPass")) is False


def test_password_policy() -> None:
    assert password_policy_violation("short1") is not None
    assert password_policy_violation("alllettershere") is not None
    assert password_policy_violation("12345678") is not None
    assert password_policy_violation("Goodpass1") is None


def test_email_helpers() -> None:
    assert is_valid_email("someone@example.com") is True
    assert is_valid_email("nope") is False
    assert is_valid_email("a@b") is False
    assert normalise_email("  Rehan@Example.COM ") == "rehan@example.com"


# --------------------------------------------------------------------------- #
# Tokens                                                                       #
# --------------------------------------------------------------------------- #
def test_access_token_roundtrip() -> None:
    token = create_access_token("42", role="user", email="me@example.com")
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["role"] == "user"
    assert payload["email"] == "me@example.com"
    assert payload["type"] == "access"


def test_token_type_is_enforced() -> None:
    refresh = create_refresh_token("42")
    with pytest.raises(TokenError):
        decode_token(refresh, expected_type="access")

    access = create_access_token("42", role="user", email="me@example.com")
    with pytest.raises(TokenError):
        decode_token(access, expected_type="refresh")


def test_expired_token_is_rejected() -> None:
    token = create_access_token("42", role="user", email="me@example.com", expires_minutes=-1)
    with pytest.raises(TokenError):
        decode_token(token)


def test_tampered_token_is_rejected() -> None:
    token = create_access_token("42", role="user", email="me@example.com")
    with pytest.raises(TokenError):
        decode_token(token[:-3] + "abc")


# --------------------------------------------------------------------------- #
# Slugs                                                                        #
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize(
    "value,expected",
    [
        ("Sirrat al-Ilm: Books & Blogs!", "sirrat-al-ilm-books-blogs"),
        ("  Spaced   Out  ", "spaced-out"),
        ("Café Résumé", "cafe-resume"),
        ("already-slug", "already-slug"),
        ("###", "item"),
        ("", ""),
    ],
)
def test_slugify(value: str, expected: str) -> None:
    assert slugify(value) == expected


# --------------------------------------------------------------------------- #
# Generated artefacts                                                          #
# --------------------------------------------------------------------------- #
def test_pdf_generator_produces_a_valid_document() -> None:
    pdf = build_book_pdf(
        title="Notes on Seeking Knowledge",
        subtitle="Adab and intention",
        author="Rehan Rae Essayyed",
        description="First paragraph.\n\nSecond paragraph with (parentheses) and a \\ backslash.",
        language="English",
        pages=96,
        edition="First edition",
        table_of_contents=[
            {"chapter": "01", "title": "Why we seek knowledge", "pages": "1—9"},
            {"chapter": "02", "title": "Intention before information", "pages": "10—19"},
        ],
    )
    assert pdf.startswith(b"%PDF-1.4")
    assert b"/Type /Catalog" in pdf
    assert b"/Count 5" in pdf  # cover + about + contents + 2 chapters
    assert pdf.rstrip().endswith(b"%%EOF")

    # The xref offsets must point at real "N 0 obj" markers.
    xref_index = pdf.index(b"\nxref\n")
    trailer_index = pdf.index(b"trailer", xref_index)
    entries = [line for line in pdf[xref_index:trailer_index].split(b"\n") if line.endswith(b"n ")]
    assert entries, "the xref table must list every object"
    for number, entry in enumerate(entries, start=1):
        offset = int(entry.split()[0])
        assert pdf[offset:offset + len(f"{number} 0 obj")] == f"{number} 0 obj".encode(), entry


def test_pdf_handles_empty_content() -> None:
    pdf = build_book_pdf(
        title="Untitled",
        subtitle=None,
        author="Anonymous",
        description="",
        language="English",
        pages=None,
        edition=None,
        table_of_contents=[],
    )
    assert pdf.startswith(b"%PDF-1.4")
    assert b"/Count 3" in pdf


def test_artwork_is_deterministic_and_escaped() -> None:
    first = build_artwork_svg("lab-demo", label="Demo <Lab> & Co")
    second = build_artwork_svg("lab-demo", label="Demo <Lab> & Co")
    assert first == second
    assert b"<svg" in first
    assert b"&lt;Lab&gt;" in first
    assert b"&amp;" in first

    different = build_artwork_svg("other-token")
    assert different != first


# --------------------------------------------------------------------------- #
# HTTP level guards                                                            #
# --------------------------------------------------------------------------- #
def test_security_headers_are_present(client: TestClient) -> None:
    headers = client.get("/api/health").headers
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "SAMEORIGIN"
    assert "default-src 'self'" in headers["content-security-policy"]
    assert headers["referrer-policy"] == "strict-origin-when-cross-origin"


def test_path_traversal_is_blocked(client: TestClient) -> None:
    for attack in (
        "/../../etc/passwd",
        "/..%2f..%2fetc%2fpasswd",
        "/assets/../../../etc/passwd",
        "/%2e%2e/%2e%2e/etc/passwd",
    ):
        response = client.get(attack)
        assert response.status_code in (200, 400, 404), attack
        if response.status_code == 200:
            # Only the SPA shell may be returned — never a system file.
            assert b"root:" not in response.content


def test_validation_error_shape(client: TestClient) -> None:
    response = client.post("/api/auth/signup", json={"email": "bad", "password": "x", "full_name": "A"})
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Validation failed"
    assert body["errors"]
    assert {"field", "message", "type"} <= set(body["errors"][0])


def test_openapi_document_is_served(client: TestClient) -> None:
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert spec["info"]["title"] == "Sirrat al-Ilm"
    assert "/api/auth/login" in spec["paths"]
    assert "/api/admin/stats" in spec["paths"]


def test_docs_are_reachable(client: TestClient) -> None:
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/health").json()["database"]["ok"] is True


def test_timing_is_reasonable(client: TestClient) -> None:
    """Guard against accidental N+1 explosions on the landing payload."""
    started = time.perf_counter()
    response = client.get("/api/health")
    elapsed = time.perf_counter() - started
    assert response.status_code == 200
    assert elapsed < 2.0
