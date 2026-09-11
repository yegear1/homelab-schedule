from __future__ import annotations

import asyncio
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
from homelab_schedule.tick import run_tick
from schemas.job import Job, JobKind, JobSource, JobStatus
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
        routines_path=str(tmp_path / "routines.yaml"),
        job_retention_days=365,
        _env_file=None,
    )
    return create_app(settings, dispatcher=dispatcher)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def _auth(api_key: str) -> dict[str, str]:
    return {"x-api-key": api_key}


def test_repository_purge_old_jobs(tmp_path: Path) -> None:
    db_path = tmp_path / "purge_repo.sqlite"
    conn = connect(str(db_path))
    repo = JobRepository(conn)

    now = datetime(2026, 9, 11, 12, 0, 0, tzinfo=UTC)
    old_time = now - timedelta(days=400)
    recent_time = now - timedelta(days=10)

    # 1. Old done job (should be purged)
    job_old_done = Job(
        id="job-old-done",
        title="Old done job",
        content="Old done",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=old_time,
        source=JobSource.SQLITE,
        status=JobStatus.DONE,
        last_run_at=old_time,
    )
    # 2. Old error job (should be purged)
    job_old_error = Job(
        id="job-old-error",
        title="Old error job",
        content="Old error",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=old_time,
        source=JobSource.SQLITE,
        status=JobStatus.ERROR,
        last_run_at=old_time,
    )
    # 3. Old scheduled job (MUST NOT be purged)
    job_old_scheduled = Job(
        id="job-old-sched",
        title="Old sched job",
        content="Old scheduled",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=old_time,
        source=JobSource.SQLITE,
        status=JobStatus.SCHEDULED,
    )
    # 4. Old yaml routine job (MUST NOT be purged)
    job_old_yaml = Job(
        id="job-old-yaml",
        title="Old yaml job",
        content="Old yaml",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.CRON,
        cron_expr="0 8 * * *",
        source=JobSource.YAML,
        status=JobStatus.DONE,
        last_run_at=old_time,
    )
    # 5. Recent done job (MUST NOT be purged)
    job_recent_done = Job(
        id="job-recent-done",
        title="Recent done job",
        content="Recent done",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=recent_time,
        source=JobSource.SQLITE,
        status=JobStatus.DONE,
        last_run_at=recent_time,
    )

    for j in [job_old_done, job_old_error, job_old_scheduled, job_old_yaml, job_recent_done]:
        repo.insert(j)

    cutoff = now - timedelta(days=365)
    deleted = repo.purge_old_jobs(cutoff)
    assert deleted == 2

    # Assert surviving jobs
    assert repo.get("job-old-done") is None
    assert repo.get("job-old-error") is None
    assert repo.get("job-old-sched") is not None
    assert repo.get("job-old-yaml") is not None
    assert repo.get("job-recent-done") is not None

    conn.close()


def test_housekeeping_purge_endpoint_auth(client: TestClient) -> None:
    response = client.post("/housekeeping/purge")
    assert response.status_code == 401


def test_housekeeping_purge_endpoint_execution(
    client: TestClient, api_key: str, app: FastAPI
) -> None:
    repo: JobRepository = app.state.repo
    now = datetime(2026, 9, 11, 12, 0, 0, tzinfo=UTC)
    old_time = now - timedelta(days=400)

    job_old = Job(
        id="purge-api-job",
        title="Purge API test",
        content="To purge",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=old_time,
        source=JobSource.SQLITE,
        status=JobStatus.DONE,
        last_run_at=old_time,
    )
    repo.insert(job_old)

    # Purge with days=365
    response = client.post("/housekeeping/purge?days=365", headers=_auth(api_key))
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "purged"
    assert data["deleted_count"] == 1
    assert data["retention_days"] == 365
    assert repo.get("purge-api-job") is None


def test_tick_periodic_housekeeping(tmp_path: Path) -> None:
    db_path = tmp_path / "tick_purge.sqlite"
    conn = connect(str(db_path))
    repo = JobRepository(conn)
    dispatcher = RecordingDispatcher()

    current_time = datetime(2026, 9, 11, 12, 0, 0, tzinfo=UTC)
    old_time = current_time - timedelta(days=400)

    job_old = Job(
        id="tick-purge-job",
        title="Tick purge test",
        content="Tick purge",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=old_time,
        source=JobSource.SQLITE,
        status=JobStatus.DONE,
        last_run_at=old_time,
    )
    repo.insert(job_old)

    stop = asyncio.Event()
    wake = asyncio.Event()

    # Run tick once and stop immediately
    async def run_and_stop() -> None:
        task = asyncio.create_task(
            run_tick(
                stop=stop,
                wake=wake,
                repo=repo,
                dispatcher=dispatcher,
                aliases={},
                now=lambda: current_time,
                cap_seconds=0.01,
                routines_path=None,
                retention_days=365,
            )
        )
        await asyncio.sleep(0.05)
        stop.set()
        wake.set()
        await task

    asyncio.run(run_and_stop())

    # Job should be purged by initial housekeeping pass
    assert repo.get("tick-purge-job") is None
    conn.close()
