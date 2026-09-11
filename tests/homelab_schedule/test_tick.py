import asyncio
import time
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from homelab_schedule.config import Settings
from homelab_schedule.main import create_app
from homelab_schedule.repository import JobRepository
from homelab_schedule.store import connect
from homelab_schedule.tick import fire_due
from schemas.job import Job, JobKind, JobStatus
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


def test_once_job_in_two_seconds_dispatches_without_cap(
    client: TestClient,
    dispatcher: RecordingDispatcher,
    api_key: str,
) -> None:
    run_at = datetime.now(UTC) + timedelta(seconds=2)
    created = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "x",
            "content": "hello-tick",
            "kind": "once",
            "run_at": run_at.isoformat(),
        },
    )
    assert created.status_code == 201
    started = time.monotonic()
    deadline = started + 4.0
    while time.monotonic() < deadline and not dispatcher.calls:
        time.sleep(0.05)
    elapsed = time.monotonic() - started
    assert dispatcher.calls
    assert dispatcher.calls[0][1] == "hello-tick"
    assert dispatcher.calls[0][0] == "5511999998888@c.us"
    assert elapsed < 300
    assert elapsed < 4.0


def test_cancel_before_due_skips_dispatch(
    client: TestClient,
    dispatcher: RecordingDispatcher,
    api_key: str,
) -> None:
    run_at = datetime.now(UTC) + timedelta(seconds=2)
    created = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "x",
            "content": "should-not-send",
            "kind": "once",
            "run_at": run_at.isoformat(),
        },
    )
    job_id = created.json()["id"]
    assert client.post(f"/jobs/{job_id}/cancel", headers=_auth(api_key)).status_code == 204
    time.sleep(2.2)
    assert dispatcher.calls == []


def test_overdue_weekly_cron_fires_once(tmp_path: Path) -> None:
    asyncio.run(_overdue_weekly_cron_fires_once(tmp_path))


async def _overdue_weekly_cron_fires_once(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    overdue = datetime(2026, 9, 7, 12, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="cron-weekly",
            title="status",
            content="Status do backup.",
            to="eu",
            kind=JobKind.CRON,
            cron_expr="0 9 * * 1",
            next_run_at=overdue,
            status=JobStatus.SCHEDULED,
        )
    )
    dispatcher = RecordingDispatcher()
    now = datetime(2026, 9, 14, 15, 0, tzinfo=UTC)
    failed = await fire_due(repo, dispatcher, {"eu": "5511999998888@c.us"}, now)
    assert failed is False
    assert len(dispatcher.calls) == 1
    stored = repo.get("cron-weekly")
    assert stored is not None
    assert stored.status is JobStatus.SCHEDULED
    assert stored.next_run_at is not None
    assert stored.next_run_at > now
    conn.close()
