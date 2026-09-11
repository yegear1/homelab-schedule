from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from homelab_schedule.config import Settings
from homelab_schedule.main import create_app
from homelab_schedule.repository import JobRepository
from schemas.job import Job, JobKind, JobSource
from tests.homelab_schedule.fakes import RecordingDispatcher


@pytest.fixture
def api_key() -> str:
    return "test-schedule-key"


@pytest.fixture
def dispatcher() -> RecordingDispatcher:
    return RecordingDispatcher()


@pytest.fixture
def app(tmp_path: Path, api_key: str, dispatcher: RecordingDispatcher) -> FastAPI:
    settings = Settings(
        schedule_api_key=api_key,
        database_path=str(tmp_path / "schedule.sqlite"),
        whatsapp_aliases="eu=5511999998888@c.us",
        _env_file=None,
    )
    return create_app(settings, dispatcher=dispatcher)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def _auth(api_key: str) -> dict[str, str]:
    return {"x-api-key": api_key}


def test_health_needs_no_key(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_jobs_without_key_is_401(client: TestClient) -> None:
    response = client.get("/jobs")
    assert response.status_code == 401


def test_create_get_list_and_notebook_event(client: TestClient, api_key: str) -> None:
    payload = {
        "title": "condomínio",
        "content": "Pagar condomínio.",
        "to": "eu",
        "kind": "once",
        "run_at": "2026-09-12T14:00:00-03:00",
    }
    created = client.post("/jobs", headers=_auth(api_key), json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["content"] == "Pagar condomínio."
    assert body["status"] == "scheduled"
    job_id = body["id"]
    listed = client.get("/jobs", headers=_auth(api_key))
    assert listed.status_code == 200
    jobs = listed.json()["jobs"]
    assert len(jobs) == 1
    assert "content" not in jobs[0]
    detail = client.get(f"/jobs/{job_id}", headers=_auth(api_key))
    assert detail.status_code == 200
    assert detail.json()["content"] == "Pagar condomínio."


def test_create_once_without_run_at_is_422(client: TestClient, api_key: str) -> None:
    response = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={"title": "x", "content": "y", "kind": "once"},
    )
    assert response.status_code == 422


def test_get_missing_job_is_404(client: TestClient, api_key: str) -> None:
    response = client.get("/jobs/missing", headers=_auth(api_key))
    assert response.status_code == 404


def test_cancel_once_returns_204_and_leaves_upcoming(client: TestClient, api_key: str) -> None:
    created = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "x",
            "content": "y",
            "kind": "once",
            "run_at": "2026-09-12T14:00:00-03:00",
        },
    )
    job_id = created.json()["id"]
    cancelled = client.post(f"/jobs/{job_id}/cancel", headers=_auth(api_key))
    assert cancelled.status_code == 204
    upcoming = client.get("/jobs", headers=_auth(api_key))
    assert upcoming.json()["jobs"] == []
    detail = client.get(f"/jobs/{job_id}", headers=_auth(api_key))
    assert detail.json()["status"] == "done"


def test_cancel_yaml_job_is_409(client: TestClient, app: FastAPI, api_key: str) -> None:
    repo = JobRepository(app.state.conn)
    repo.insert(
        Job(
            id="yaml-backup",
            title="backup",
            content="Status do backup.",
            to="eu",
            kind=JobKind.ONCE,
            run_at=datetime(2026, 9, 12, 17, 0, tzinfo=UTC),
            source=JobSource.YAML,
        )
    )
    response = client.post("/jobs/yaml-backup/cancel", headers=_auth(api_key))
    assert response.status_code == 409
    assert "routines.yaml" in response.json()["detail"]


def test_run_now_queues_without_replacing_schedule(
    client: TestClient, dispatcher: RecordingDispatcher, api_key: str
) -> None:
    created = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "x",
            "content": "y",
            "kind": "once",
            "run_at": "2026-09-12T14:00:00-03:00",
        },
    )
    job_id = created.json()["id"]
    next_before = created.json()["next_run_at"]
    response = client.post(f"/jobs/{job_id}/run", headers=_auth(api_key))
    assert response.status_code == 202
    assert response.json() == {"status": "queued", "job_id": job_id}
    assert dispatcher.calls
    assert dispatcher.calls[0][0] == "5511999998888@c.us"
    detail = client.get(f"/jobs/{job_id}", headers=_auth(api_key))
    body = detail.json()
    assert body["status"] == "scheduled"
    assert body["next_run_at"] == next_before
    assert body["last_status"] == "queued"


def test_run_now_gatekeeper_failure_is_502(tmp_path: Path, api_key: str) -> None:
    dispatcher = RecordingDispatcher(status_code=500)
    settings = Settings(
        schedule_api_key=api_key,
        database_path=str(tmp_path / "schedule.sqlite"),
        _env_file=None,
    )
    app = create_app(settings, dispatcher=dispatcher)
    with TestClient(app) as client:
        created = client.post(
            "/jobs",
            headers=_auth(api_key),
            json={
                "title": "x",
                "content": "y",
                "kind": "once",
                "run_at": "2026-09-12T14:00:00-03:00",
            },
        )
        job_id = created.json()["id"]
        response = client.post(f"/jobs/{job_id}/run", headers=_auth(api_key))
        assert response.status_code == 502
