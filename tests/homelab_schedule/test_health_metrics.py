import asyncio
import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from homelab_schedule.config import Settings
from homelab_schedule.jobs_service import JobService
from homelab_schedule.main import create_app
from homelab_schedule.mcp_http import AgendaApi
from homelab_schedule.mcp_stdio import build_mcp
from homelab_schedule.mcp_tools import handle_health_metrics
from homelab_schedule.repository import JobRepository
from homelab_schedule.store import connect
from schemas.job import Job, JobKind, JobRun, JobRunStatus, JobRunTrigger, JobSource, JobStatus
from tests.homelab_schedule.fakes import RecordingDispatcher

NOW = datetime(2026, 10, 31, 12, tzinfo=UTC)


@pytest.fixture
def repo(tmp_path: Path) -> Iterator[JobRepository]:
    conn = connect(str(tmp_path / "metrics.sqlite"))
    yield JobRepository(conn)
    conn.close()


def _service(repo: JobRepository) -> JobService:
    return JobService(repo, asyncio.Event(), RecordingDispatcher(), {}, lambda: NOW)


def _job(repo: JobRepository, job_id: str, **updates: object) -> Job:
    fields: dict[str, object] = {
        "id": job_id,
        "title": "private-title",
        "content": "private-content",
        "to": "private-phone",
        "kind": JobKind.ONCE,
        "run_at": NOW + timedelta(hours=1),
    }
    fields.update(updates)
    return repo.insert(Job.model_validate(fields))


def _run(
    repo: JobRepository,
    run_id: str,
    at: datetime,
    status: JobRunStatus = JobRunStatus.SUCCESS,
    duration: float = 10,
) -> None:
    repo.record_run(
        JobRun(
            id=run_id,
            job_id="job",
            ran_at=at,
            trigger=JobRunTrigger.MANUAL,
            status=status,
            status_code=202 if status == JobRunStatus.SUCCESS else 500,
            duration_ms=duration,
            error_message="private-error",
        )
    )


def test_empty_metrics_and_utc_clock(repo: JobRepository) -> None:
    metrics = _service(repo).health_metrics()
    assert metrics.status == "ok"
    assert metrics.generated_at == NOW
    assert metrics.window_start == NOW - timedelta(hours=24)
    assert metrics.jobs.total == metrics.runs.total == 0
    assert metrics.jobs.next_run_at is None
    assert metrics.runs.latest_run_at is None
    assert metrics.runs.mean_duration_ms is None
    assert metrics.success_percentage is None


def test_job_counts_include_yaml_and_exclude_inactive_due_jobs(repo: JobRepository) -> None:
    _job(repo, "overdue", run_at=NOW - timedelta(seconds=1), source=JobSource.YAML)
    _job(repo, "due-now", run_at=NOW)
    _job(repo, "future")
    _job(repo, "disabled", run_at=NOW - timedelta(days=2), enabled=False)
    _job(repo, "paused", run_at=NOW - timedelta(days=3), status=JobStatus.PAUSED)
    _job(repo, "done", status=JobStatus.DONE)
    _job(repo, "error", status=JobStatus.ERROR)
    metrics = _service(repo).health_metrics()
    assert metrics.status == "attention_required"
    assert metrics.jobs.model_dump() == {
        "total": 7,
        "scheduled": 4,
        "done": 1,
        "paused": 1,
        "error": 1,
        "sqlite": 6,
        "yaml": 1,
        "enabled_scheduled": 3,
        "overdue": 1,
        "next_run_at": NOW - timedelta(seconds=1),
    }
    text = metrics.model_dump_json()
    assert all(
        secret not in text for secret in ("private-title", "private-phone", "private-content")
    )


@pytest.mark.parametrize("reason", ["overdue", "job_error", "run_error"])
def test_each_attention_condition_is_independent(repo: JobRepository, reason: str) -> None:
    _job(
        repo,
        "job",
        status=JobStatus.ERROR if reason == "job_error" else JobStatus.SCHEDULED,
        run_at=NOW - timedelta(seconds=1) if reason == "overdue" else NOW,
    )
    if reason == "run_error":
        _run(repo, "failed", NOW, JobRunStatus.ERROR)
    assert _service(repo).health_metrics().status == "attention_required"


def test_attempt_window_is_inclusive_and_uses_all_retained_rows(repo: JobRepository) -> None:
    _job(repo, "job")
    _run(repo, "before", NOW - timedelta(hours=24, microseconds=1), JobRunStatus.ERROR)
    _run(repo, "start", NOW - timedelta(hours=24), duration=30)
    _run(repo, "end", NOW, JobRunStatus.ERROR, duration=90)
    _run(repo, "future", NOW + timedelta(microseconds=1), JobRunStatus.ERROR)
    metrics = _service(repo).health_metrics()
    assert metrics.runs.total == 2
    assert metrics.runs.success == metrics.runs.error == 1
    assert metrics.success_percentage == 50
    assert metrics.runs.mean_duration_ms == 60
    assert metrics.runs.latest_run_at == NOW
    assert "private-error" not in metrics.model_dump_json()
    short = _service(repo).health_metrics(1)
    assert short.runs.total == 1
    assert short.success_percentage == 0
    for i in range(101):
        _run(repo, f"many-{i}", NOW)
    assert _service(repo).health_metrics().runs.total == 103


def test_inactive_jobs_and_old_failures_do_not_require_attention(repo: JobRepository) -> None:
    _job(repo, "job", enabled=False, run_at=NOW - timedelta(days=1))
    _job(repo, "paused", status=JobStatus.PAUSED, run_at=NOW - timedelta(days=1))
    _run(repo, "old", NOW - timedelta(hours=25), JobRunStatus.ERROR)
    _run(repo, "accepted", NOW)
    metrics = _service(repo).health_metrics()
    assert metrics.status == "ok"
    assert metrics.success_percentage == 100
    assert metrics.jobs.next_run_at is None


@pytest.mark.parametrize("hours", [0, 169])
def test_service_rejects_invalid_windows(repo: JobRepository, hours: int) -> None:
    with pytest.raises(ValueError, match="window_hours"):
        _service(repo).health_metrics(hours)


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    settings = Settings(
        schedule_api_key="metrics-test-key",
        database_path=str(tmp_path / "api.sqlite"),
        routines_path=str(tmp_path / "absent.yaml"),
        _env_file=None,
    )
    with TestClient(create_app(settings, dispatcher=RecordingDispatcher(), now=lambda: NOW)) as c:
        yield c


def test_http_auth_defaults_and_liveness(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/health/metrics").status_code == 401
    assert client.get("/health/metrics", headers={"x-api-key": "wrong"}).status_code == 401
    response = client.get("/health/metrics", headers={"x-api-key": "metrics-test-key"})
    assert response.status_code == 200
    assert response.json()["window_hours"] == 24
    assert response.json()["status"] == "ok"


@pytest.mark.parametrize(
    "hours,code", [("1", 200), ("168", 200), ("0", 422), ("169", 422), ("abc", 422), ("1.5", 422)]
)
def test_http_window_bounds(client: TestClient, hours: str, code: int) -> None:
    response = client.get(
        "/health/metrics", params={"window_hours": hours}, headers={"x-api-key": "metrics-test-key"}
    )
    assert response.status_code == code
    if code == 200:
        assert response.json()["window_hours"] == int(hours)


@pytest.mark.parametrize("hours", [24, 168])
def test_mcp_bridge_and_registration(hours: int) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/health/metrics"
        assert request.url.params["window_hours"] == str(hours)
        assert request.headers["x-api-key"] == "test-key"
        return httpx.Response(200, json={"status": "ok", "jobs": {"total": 4}})

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        api = AgendaApi("http://schedule.test", "test-key", http)
        text = handle_health_metrics(api, hours)
        assert json.loads(text) == {"status": "ok", "jobs": {"total": 4}}
        assert "\n" not in text
        tool = build_mcp(api)._tool_manager._tools["health_metrics"]
        schema = tool.parameters["properties"]["window_hours"]
        assert schema["default"] == 24
        assert schema["minimum"] == 1
        assert schema["maximum"] == 168


@pytest.mark.parametrize("code", [401, 422, 503])
def test_mcp_http_errors_are_structured(code: int) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(code, json={"detail": "invalid window"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        api = AgendaApi("http://schedule.test", "test-key", http)
        result = json.loads(handle_health_metrics(api, 0))
        assert "error" in result
        assert "test-key" not in result["error"]


def test_mcp_network_failure_is_structured() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("unavailable", request=request)

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        api = AgendaApi("http://schedule.test", "test-key", http)
        assert "error" in json.loads(handle_health_metrics(api))
