"""Authentication + account self-service tests."""

from __future__ import annotations

from typing import Dict

from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD, unique_email


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"]["ok"] is True


def test_signup_returns_profile_and_tokens(client: TestClient) -> None:
    response = client.post(
        "/api/auth/signup",
        json={
            "full_name": "  Fatima   Noor ",
            "email": unique_email(),
            "password": "SecurePass1",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()

    # Name is normalised, role is a plain user, tokens are present.
    assert body["user"]["full_name"] == "Fatima Noor"
    assert body["user"]["role"] == "user"
    assert body["is_admin"] is False
    assert body["tokens"]["token_type"] == "bearer"
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]
    assert "password_hash" not in body["user"]


def test_signup_rejects_duplicate_email(client: TestClient) -> None:
    email = unique_email()
    payload = {"full_name": "Duplicate User", "email": email, "password": "SecurePass1"}
    assert client.post("/api/auth/signup", json=payload).status_code == 201

    response = client.post("/api/auth/signup", json=payload)
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_signup_rejects_weak_password(client: TestClient) -> None:
    # Too short -> Pydantic 422 with structured field errors.
    short = client.post(
        "/api/auth/signup",
        json={"full_name": "Weak User", "email": unique_email(), "password": "abc"},
    )
    assert short.status_code == 422
    assert short.json()["detail"] == "Validation failed"
    assert short.json()["errors"][0]["field"] == "password"

    # Long enough but no digit -> rejected by the password policy.
    no_digit = client.post(
        "/api/auth/signup",
        json={"full_name": "Weak User", "email": unique_email(), "password": "onlyletters"},
    )
    assert no_digit.status_code == 422
    assert "number" in no_digit.json()["detail"]


def test_signup_rejects_invalid_email(client: TestClient) -> None:
    response = client.post(
        "/api/auth/signup",
        json={"full_name": "Bad Email", "email": "not-an-email", "password": "SecurePass1"},
    )
    assert response.status_code == 422


def test_login_wrong_password_is_401(client: TestClient, new_user: Dict[str, object]) -> None:
    response = client.post(
        "/api/auth/login", json={"email": new_user["email"], "password": "WrongPass123"}
    )
    assert response.status_code == 401
    # Generic message on purpose: the endpoint must not reveal which e-mails exist.
    assert response.json()["detail"] == "Incorrect e-mail or password."


def test_login_unknown_email_is_401(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"email": unique_email(), "password": "Whatever123"}
    )
    assert response.status_code == 401


def test_login_is_case_insensitive_for_email(client: TestClient, new_user: Dict[str, object]) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": str(new_user["email"]).upper(), "password": new_user["password"]},
    )
    assert response.status_code == 200
    assert response.json()["user"]["email"] == new_user["email"]


def test_owner_login_is_admin(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["role"] == "admin"
    assert body["is_admin"] is True


def test_me_requires_a_token(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_me_returns_current_user(client: TestClient, new_user: Dict[str, object]) -> None:
    response = client.get("/api/auth/me", headers=new_user["headers"])  # type: ignore[arg-type]
    assert response.status_code == 200
    assert response.json()["email"] == new_user["email"]


def test_refresh_flow(client: TestClient, new_user: Dict[str, object]) -> None:
    tokens = new_user["tokens"]
    response = client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 200
    fresh = response.json()["tokens"]["access_token"]
    assert fresh and fresh != tokens["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fresh}"})
    assert me.status_code == 200


def test_refresh_rejects_an_access_token(client: TestClient, new_user: Dict[str, object]) -> None:
    response = client.post(
        "/api/auth/refresh", json={"refresh_token": new_user["tokens"]["access_token"]}
    )
    assert response.status_code == 401


def test_update_profile(client: TestClient, new_user: Dict[str, object]) -> None:
    headers = new_user["headers"]
    response = client.patch(
        "/api/users/me",
        headers=headers,  # type: ignore[arg-type]
        json={"bio": "Learning in public.", "occupation": "Student", "full_name": "Fatima N."},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["bio"] == "Learning in public."
    assert body["full_name"] == "Fatima N."


def test_update_profile_rejects_unknown_fields(client: TestClient, new_user: Dict[str, object]) -> None:
    response = client.patch(
        "/api/users/me", headers=new_user["headers"], json={"role": "admin"}  # type: ignore[arg-type]
    )
    # Escalation attempt is refused by the schema (extra="forbid").
    assert response.status_code == 422


def test_change_password_then_login(client: TestClient, new_user: Dict[str, object]) -> None:
    headers = new_user["headers"]
    changed = client.post(
        "/api/users/me/password",
        headers=headers,  # type: ignore[arg-type]
        json={"current_password": new_user["password"], "new_password": "BrandNewPass1"},
    )
    assert changed.status_code == 200, changed.text

    assert (
        client.post(
            "/api/auth/login", json={"email": new_user["email"], "password": "BrandNewPass1"}
        ).status_code
        == 200
    )


def test_change_password_requires_the_current_one(
    client: TestClient, new_user: Dict[str, object]
) -> None:
    response = client.post(
        "/api/users/me/password",
        headers=new_user["headers"],  # type: ignore[arg-type]
        json={"current_password": "NotMyPassword1", "new_password": "BrandNewPass2"},
    )
    assert response.status_code == 400


def test_deactivated_user_cannot_sign_in(
    client: TestClient, new_user: Dict[str, object], admin_headers: Dict[str, str]
) -> None:
    user_id = new_user["user"]["id"]
    deactivate = client.patch(
        f"/api/admin/people/{user_id}/active", headers=admin_headers, json={"is_active": False}
    )
    assert deactivate.status_code == 200, deactivate.text

    login = client.post(
        "/api/auth/login", json={"email": new_user["email"], "password": new_user["password"]}
    )
    assert login.status_code == 403

    # Existing tokens stop working immediately too.
    assert client.get("/api/content/home", headers=new_user["headers"]).status_code == 403  # type: ignore[arg-type]

    # Restore for the rest of the suite.
    assert (
        client.patch(
            f"/api/admin/people/{user_id}/active", headers=admin_headers, json={"is_active": True}
        ).status_code
        == 200
    )
