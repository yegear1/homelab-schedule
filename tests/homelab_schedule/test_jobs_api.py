from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from homelab_schedule.config import Settings
from homelab_schedule.main import create_app
from homelab_schedule.repository import JobRepository
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
        "run_at": "2027-09-12T14:00:00-03:00",
    }
    created = client.post("/jobs", headers=_auth(api_key), json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["content"] == "Pagar condomínio."
    assert body["status"] == "scheduled"
    assert body["target_number"] == "5511999998888@c.us"
    job_id = body["id"]
    listed = client.get("/jobs", headers=_auth(api_key))
    assert listed.status_code == 200
    jobs = listed.json()["jobs"]
    assert len(jobs) == 1
    assert "content" not in jobs[0]
    assert jobs[0]["target_number"] == "5511999998888@c.us"
    detail = client.get(f"/jobs/{job_id}", headers=_auth(api_key))
    assert detail.status_code == 200
    assert detail.json()["content"] == "Pagar condomínio."
    assert detail.json()["target_number"] == "5511999998888@c.us"


def test_list_jobs_filter_by_error_and_limit(
    client: TestClient, api_key: str, app: FastAPI
) -> None:
    repo: JobRepository = app.state.repo
    # Create two jobs with status=error and one with status=done
    job1 = Job(
        id="err-1",
        title="Error 1",
        content="Error 1",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2026, 9, 12, 10, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.ERROR,
    )
    job2 = Job(
        id="err-2",
        title="Error 2",
        content="Error 2",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2026, 9, 12, 11, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.ERROR,
    )
    job3 = Job(
        id="done-1",
        title="Done 1",
        content="Done 1",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2026, 9, 12, 12, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.DONE,
    )
    repo.insert(job1)
    repo.insert(job2)
    repo.insert(job3)

    # Filter status=error without limit
    resp_err = client.get("/jobs?status=error", headers=_auth(api_key))
    assert resp_err.status_code == 200
    err_jobs = resp_err.json()["jobs"]
    assert len(err_jobs) == 2
    assert all(j["status"] == "error" for j in err_jobs)

    # Filter status=error with limit=1
    resp_lim = client.get("/jobs?status=error&limit=1", headers=_auth(api_key))
    assert resp_lim.status_code == 200
    assert len(resp_lim.json()["jobs"]) == 1


def test_create_with_explicit_target_number(client: TestClient, api_key: str) -> None:
    payload = {
        "title": "recado direto",
        "content": "Aviso pontual.",
        "to": "joao",
        "target_number": "5521977778888",
        "kind": "once",
        "run_at": "2027-09-12T14:00:00-03:00",
    }
    created = client.post("/jobs", headers=_auth(api_key), json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["to"] == "joao"
    assert body["target_number"] == "5521977778888@c.us"


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
            "run_at": "2027-09-12T14:00:00-03:00",
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
            "run_at": "2027-09-12T14:00:00-03:00",
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
        routines_path=str(tmp_path / "routines.yaml"),
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
                "run_at": "2027-09-12T14:00:00-03:00",
            },
        )
        job_id = created.json()["id"]
        response = client.post(f"/jobs/{job_id}/run", headers=_auth(api_key))
        assert response.status_code == 502


def test_reschedule_once_job_updates_time_and_reactivates(
    client: TestClient, api_key: str
) -> None:
    created = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "reunião",
            "content": "Reunião de alinhamento.",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    )
    job_id = created.json()["id"]
    client.post(f"/jobs/{job_id}/cancel", headers=_auth(api_key))
    detail_cancelled = client.get(f"/jobs/{job_id}", headers=_auth(api_key))
    assert detail_cancelled.json()["status"] == "done"

    rescheduled = client.post(
        f"/jobs/{job_id}/reschedule",
        headers=_auth(api_key),
        json={"run_at": "2026-09-13T10:00:00-03:00"},
    )
    assert rescheduled.status_code == 200
    body = rescheduled.json()
    assert body["status"] == "scheduled"
    assert body["enabled"] is True
    assert body["next_run_at"] in {"2026-09-13T13:00:00Z", "2026-09-13T13:00:00+00:00"}


def test_reschedule_yaml_job_is_409(client: TestClient, app: FastAPI, api_key: str) -> None:
    repo = JobRepository(app.state.conn)
    repo.insert(
        Job(
            id="yaml-report",
            title="report",
            content="Relatório.",
            to="eu",
            kind=JobKind.ONCE,
            run_at=datetime(2026, 9, 12, 17, 0, tzinfo=UTC),
            source=JobSource.YAML,
        )
    )
    response = client.post(
        "/jobs/yaml-report/reschedule",
        headers=_auth(api_key),
        json={"run_at": "2026-09-13T10:00:00-03:00"},
    )
    assert response.status_code == 409
    assert "routines.yaml" in response.json()["detail"]


def test_reschedule_missing_job_is_404(client: TestClient, api_key: str) -> None:
    response = client.post(
        "/jobs/missing-job/reschedule",
        headers=_auth(api_key),
        json={"run_at": "2026-09-13T10:00:00-03:00"},
    )
    assert response.status_code == 404


def test_create_job_stores_created_by(client: TestClient, api_key: str) -> None:
    created = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "x",
            "content": "y",
            "to": "eu",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
            "created_by": "5521912345678",
        },
    )
    assert created.status_code == 201
    assert created.json()["created_by"] == "5521912345678@c.us"


def test_list_jobs_phone_unions_destination_and_creator(
    client: TestClient, api_key: str
) -> None:
    for_them = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "para lia",
            "content": "y",
            "to": "5511911112222",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    )
    by_them = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "lia criou",
            "content": "y",
            "to": "eu",
            "kind": "once",
            "run_at": "2027-09-12T15:00:00-03:00",
            "created_by": "5511911112222",
        },
    )
    other = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "outro",
            "content": "y",
            "to": "eu",
            "kind": "once",
            "run_at": "2027-09-12T16:00:00-03:00",
        },
    )
    assert for_them.status_code == 201
    assert by_them.status_code == 201
    assert other.status_code == 201
    listed = client.get(
        "/jobs?status=all&phone=5511911112222",
        headers=_auth(api_key),
    )
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()["jobs"]}
    assert for_them.json()["id"] in ids
    assert by_them.json()["id"] in ids
    assert other.json()["id"] not in ids


def test_create_batch_jobs_success(client: TestClient, api_key: str) -> None:
    res = client.post(
        "/jobs/batch",
        headers=_auth(api_key),
        json={
            "recipients": ["5511999991111", "5511999992222"],
            "title": "Aviso Grupo",
            "content": "Olá {{name}}, temos reunião.",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
            "created_by": "5511988887777",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["count"] == 2
    group_id = body["group_id"]
    assert group_id.startswith("grp_")
    assert len(body["jobs"]) == 2
    for job in body["jobs"]:
        assert job["group_id"] == group_id
        assert job["title"] == "Aviso Grupo"

    # Filter by group_id in GET /jobs
    filter_res = client.get(f"/jobs?group_id={group_id}", headers=_auth(api_key))
    assert filter_res.status_code == 200
    group_jobs = filter_res.json()["jobs"]
    assert len(group_jobs) == 2
    assert {j["id"] for j in group_jobs} == {j["id"] for j in body["jobs"]}


def test_group_cancel_and_run(client: TestClient, api_key: str) -> None:
    # 1. Create batch to test run
    run_batch = client.post(
        "/jobs/batch",
        headers=_auth(api_key),
        json={
            "recipients": ["5511999991111", "5511999992222"],
            "title": "Disparo Grupo",
            "content": "Texto rápido",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    ).json()
    run_group_id = run_batch["group_id"]

    run_res = client.post(f"/jobs/group/{run_group_id}/run", headers=_auth(api_key))
    assert run_res.status_code == 202
    assert run_res.json()["affected"] == 2

    for job_summary in run_batch["jobs"]:
        job_detail = client.get(f"/jobs/{job_summary['id']}", headers=_auth(api_key)).json()
        assert job_detail["last_status"] == "queued"
        assert job_detail["last_run_at"] is not None

    # 2. Create batch to test cancel
    cancel_batch = client.post(
        "/jobs/batch",
        headers=_auth(api_key),
        json={
            "recipients": ["5511999993333", "5511999994444"],
            "title": "Cancel Grupo",
            "content": "Texto cancelado",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    ).json()
    cancel_group_id = cancel_batch["group_id"]

    cancel_res = client.post(f"/jobs/group/{cancel_group_id}/cancel", headers=_auth(api_key))
    assert cancel_res.status_code == 200
    assert cancel_res.json()["affected"] == 2

    for job_summary in cancel_batch["jobs"]:
        job_detail = client.get(f"/jobs/{job_summary['id']}", headers=_auth(api_key)).json()
        assert job_detail["status"] == "done"


def test_list_jobs_query_text_search(client: TestClient, api_key: str) -> None:
    j1 = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Comprar remédio",
            "content": "Pegar dorflex na farmácia",
            "to": "eu",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    ).json()

    j2 = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Reunião de condomínio",
            "content": "Apresentar prestação de contas",
            "to": "sindico",
            "kind": "once",
            "run_at": "2027-09-12T15:00:00-03:00",
        },
    ).json()

    j3 = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Aluguel",
            "content": "Pagar boleto e levar o remédio",
            "to": "proprietario",
            "kind": "once",
            "run_at": "2027-09-12T16:00:00-03:00",
        },
    ).json()

    # 1. Search in title and content
    res_remedio = client.get("/jobs?query=remédio", headers=_auth(api_key))
    assert res_remedio.status_code == 200
    ids_remedio = {item["id"] for item in res_remedio.json()["jobs"]}
    assert j1["id"] in ids_remedio
    assert j3["id"] in ids_remedio
    assert j2["id"] not in ids_remedio

    # 2. Case-insensitive search in content
    res_dorflex = client.get("/jobs?query=DORFLEX", headers=_auth(api_key))
    assert res_dorflex.status_code == 200
    ids_dorflex = {item["id"] for item in res_dorflex.json()["jobs"]}
    assert ids_dorflex == {j1["id"]}

    # 3. Combined query + phone filter
    res_combined = client.get("/jobs?query=remédio&phone=eu", headers=_auth(api_key))
    assert res_combined.status_code == 200
    ids_combined = {item["id"] for item in res_combined.json()["jobs"]}
    assert ids_combined == {j1["id"]}

