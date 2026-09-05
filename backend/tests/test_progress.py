"""Learning-progress tracking (the user dashboard's data source)."""

from __future__ import annotations

from typing import Dict

from fastapi.testclient import TestClient


def _first_video_id(client: TestClient, headers: Dict[str, str]) -> int:
    shelves = client.get("/api/shelves", headers=headers).json()
    return shelves[0]["resources"][0]["id"]


def test_progress_requires_auth(client: TestClient) -> None:
    assert client.get("/api/progress").status_code == 401
    assert client.put("/api/progress", json={"resource_type": "video", "resource_id": 1}).status_code == 401


def test_upsert_creates_then_updates(client: TestClient, new_user: Dict[str, object]) -> None:
    headers = new_user["headers"]
    video_id = _first_video_id(client, headers)  # type: ignore[arg-type]

    created = client.put(
        "/api/progress",
        headers=headers,  # type: ignore[arg-type]
        json={"resource_type": "video", "resource_id": video_id, "progress_percent": 25},
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["status"] == "in_progress"
    assert body["progress_percent"] == 25
    # The server filled in the snapshot from the database.
    assert body["resource_title"]
    assert body["meta"]["external_url"]

    updated = client.put(
        "/api/progress",
        headers=headers,  # type: ignore[arg-type]
        json={"resource_type": "video", "resource_id": video_id, "progress_percent": 70},
    )
    assert updated.status_code == 200
    assert updated.json()["id"] == body["id"], "upsert must update, not duplicate"
    assert updated.json()["progress_percent"] == 70


def test_completion_sets_100_and_timestamp(
    client: TestClient, new_user: Dict[str, object]
) -> None:
    headers = new_user["headers"]
    video_id = _first_video_id(client, headers)  # type: ignore[arg-type]

    client.put(
        "/api/progress",
        headers=headers,  # type: ignore[arg-type]
        json={"resource_type": "video", "resource_id": video_id, "progress_percent": 100},
    )
    entry = client.get(
        "/api/progress/entries", params={"resource_type": "video"}, headers=headers  # type: ignore[arg-type]
    ).json()[0]
    assert entry["status"] == "completed"
    assert entry["completed_at"] is not None

    # The explicit /complete endpoint is idempotent.
    done = client.post(f"/api/progress/{entry['id']}/complete", headers=headers)  # type: ignore[arg-type]
    assert done.status_code == 200
    assert done.json()["progress_percent"] == 100


def test_notes_can_be_saved(client: TestClient, new_user: Dict[str, object]) -> None:
    headers = new_user["headers"]
    video_id = _first_video_id(client, headers)  # type: ignore[arg-type]
    entry = client.put(
        "/api/progress",
        headers=headers,  # type: ignore[arg-type]
        json={"resource_type": "video", "resource_id": video_id, "progress_percent": 10},
    ).json()

    saved = client.patch(
        f"/api/progress/{entry['id']}/notes",
        headers=headers,  # type: ignore[arg-type]
        json={
            "resource_type": "video",
            "resource_id": video_id,
            "notes": "Revisit the section on sincerity.",
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["notes"] == "Revisit the section on sincerity."


def test_dashboard_aggregates(client: TestClient, new_user: Dict[str, object]) -> None:
    headers = new_user["headers"]
    shelves = client.get("/api/shelves", headers=headers).json()  # type: ignore[arg-type]
    videos = shelves[0]["resources"][:3]

    client.put("/api/progress", headers=headers, json={  # type: ignore[arg-type]
        "resource_type": "video", "resource_id": videos[0]["id"], "progress_percent": 100})
    client.put("/api/progress", headers=headers, json={  # type: ignore[arg-type]
        "resource_type": "video", "resource_id": videos[1]["id"], "progress_percent": 40})

    books = client.get("/api/books", headers=headers).json()  # type: ignore[arg-type]
    client.put("/api/progress", headers=headers, json={  # type: ignore[arg-type]
        "resource_type": "book", "resource_id": books[0]["id"], "progress_percent": 100})

    dashboard = client.get("/api/progress", headers=headers).json()  # type: ignore[arg-type]
    totals = dashboard["totals"]
    assert totals["tracked"] == 3
    assert totals["completed"] == 2
    assert totals["in_progress"] == 1
    assert totals["completion_rate"] == 66.7
    assert len(dashboard["continue_learning"]) == 1
    assert len(dashboard["completed"]) == 2
    assert {stat["key"] for stat in dashboard["by_type"]} == {"video", "book", "blog", "lab"}
    assert dashboard["recent_activity"]


def test_unknown_resource_is_404(client: TestClient, new_user: Dict[str, object]) -> None:
    response = client.put(
        "/api/progress",
        headers=new_user["headers"],  # type: ignore[arg-type]
        json={"resource_type": "video", "resource_id": 999_999, "progress_percent": 50},
    )
    assert response.status_code == 404


def test_invalid_payload_is_rejected(client: TestClient, new_user: Dict[str, object]) -> None:
    headers = new_user["headers"]
    too_far = client.put(
        "/api/progress",
        headers=headers,  # type: ignore[arg-type]
        json={"resource_type": "video", "resource_id": 1, "progress_percent": 150},
    )
    assert too_far.status_code == 422

    bad_type = client.put(
        "/api/progress",
        headers=headers,  # type: ignore[arg-type]
        json={"resource_type": "podcast", "resource_id": 1},
    )
    assert bad_type.status_code == 422


def test_users_cannot_touch_each_others_rows(
    client: TestClient, new_user: Dict[str, object], admin_headers: Dict[str, str]
) -> None:
    """Cross-user access returns 404 so entry ids cannot be probed."""
    mine = client.get("/api/progress", headers=admin_headers).json()
    if not mine["recent_activity"]:
        # Give the admin a row to protect.
        video_id = _first_video_id(client, admin_headers)
        client.put(
            "/api/progress",
            headers=admin_headers,
            json={"resource_type": "video", "resource_id": video_id, "progress_percent": 10},
        )
        mine = client.get("/api/progress", headers=admin_headers).json()

    entry_id = mine["recent_activity"][0]["id"]
    other_headers = new_user["headers"]

    assert (
        client.post(f"/api/progress/{entry_id}/complete", headers=other_headers).status_code  # type: ignore[arg-type]
        == 404
    )
    assert client.delete(f"/api/progress/{entry_id}", headers=other_headers).status_code == 404  # type: ignore[arg-type]

    # The owner can still see their own row.
    assert client.get("/api/progress/entries", headers=admin_headers).status_code == 200


def test_delete_removes_the_row(client: TestClient, new_user: Dict[str, object]) -> None:
    headers = new_user["headers"]
    video_id = _first_video_id(client, headers)  # type: ignore[arg-type]
    entry = client.put(
        "/api/progress",
        headers=headers,  # type: ignore[arg-type]
        json={"resource_type": "video", "resource_id": video_id, "progress_percent": 5},
    ).json()

    assert client.delete(f"/api/progress/{entry['id']}", headers=headers).status_code == 204  # type: ignore[arg-type]
    remaining = client.get("/api/progress/entries", headers=headers).json()  # type: ignore[arg-type]
    assert entry["id"] not in [row["id"] for row in remaining]
