from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
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


def test_preview_job_once_friendly_when(client: TestClient, api_key: str) -> None:
    payload = {
        "when": "2027-09-12T14:00:00-03:00",
        "content": "Olá {{name}}, lembrete para {{date}} às {{time}} ({{weekday}} - {{day_name}}).",
        "to": "eu",
    }
    response = client.post("/jobs/preview", headers=_auth(api_key), json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "once"
    assert body["to"] == "eu"
    assert body["target_number"] == "5511999998888@c.us"
    expected_title = (
        "Olá {{name}}, lembrete para {{date}} às {{time}} ({{weekday}} - {{day_name}})."
    )
    assert body["title"] == expected_title
    assert body["next_run_at"] is not None
    assert "2027-09-12" in body["next_run_at_local"]
    assert "14:00:00" in body["next_run_at_local"]
    assert "12/09/2027" in body["rendered_content"]
    assert "14:00" in body["rendered_content"]
    assert "dom" in body["rendered_content"]
    assert "domingo" in body["rendered_content"]
    assert body["variables"]["date"] == "12/09/2027"
    assert body["variables"]["time"] == "14:00"
    assert body["variables"]["weekday"] == "dom"
    assert body["variables"]["day_name"] == "domingo"

    # Verify dry-run guarantees: no job was saved to DB
    listed = client.get("/jobs", headers=_auth(api_key))
    assert listed.status_code == 200
    assert len(listed.json()["jobs"]) == 0


def test_preview_job_cron(client: TestClient, api_key: str) -> None:
    payload = {
        "when": "0 9 * * 1",
        "content": "Reunião semanal toda segunda às 09:00",
        "to": "eu",
        "title": "Reunião Semanal",
    }
    response = client.post("/jobs/preview", headers=_auth(api_key), json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "cron"
    assert body["cron_expr"] == "0 9 * * 1"
    assert body["title"] == "Reunião Semanal"
    assert body["next_run_at"] is not None
    assert body["next_run_at_local"] is not None


def test_preview_job_with_contacts_and_template_id(client: TestClient, api_key: str) -> None:
    # 1. Create a contact
    contact_res = client.post(
        "/contacts",
        headers=_auth(api_key),
        json={
            "name": "Maria",
            "phone": "5511888887777@c.us",
            "alias": "maria",
        },
    )
    assert contact_res.status_code == 201

    # 2. Create a template
    tmpl_res = client.post(
        "/templates",
        headers=_auth(api_key),
        json={
            "name": "Consulta",
            "body": "Olá {{name}}, sua consulta está marcada para {{date}} às {{time}}.",
        },
    )
    assert tmpl_res.status_code == 201
    tmpl_id = tmpl_res.json()["id"]

    # 3. Preview using contact alias and template_id
    preview_res = client.post(
        "/jobs/preview",
        headers=_auth(api_key),
        json={
            "when": "2027-09-15T10:30:00-03:00",
            "to": "maria",
            "template_id": tmpl_id,
        },
    )
    assert preview_res.status_code == 200
    body = preview_res.json()
    assert body["to"] == "maria"
    assert body["target_number"] == "5511888887777@c.us"
    assert body["recipient_name"] == "Maria"
    assert body["template_id"] == tmpl_id
    assert "Olá {{name}}, sua consulta" in body["raw_content"]
    assert "às {{time}}." in body["raw_content"]
    assert "Olá Maria, sua consulta" in body["rendered_content"]
    assert "15/09/2027 às 10:30." in body["rendered_content"]
    assert body["variables"]["name"] == "Maria"
    assert body["variables"]["date"] == "15/09/2027"
    assert body["variables"]["time"] == "10:30"


def test_preview_job_validation_and_errors(client: TestClient, api_key: str) -> None:
    # 1. 401 Unauthorized
    res_401 = client.post("/jobs/preview", json={"when": "amanhã 10h", "content": "Teste"})
    assert res_401.status_code == 401

    # 2. 422: both content and template_id provided
    res_both = client.post(
        "/jobs/preview",
        headers=_auth(api_key),
        json={"when": "amanhã 10h", "content": "A", "template_id": "B"},
    )
    assert res_both.status_code == 422

    # 3. 422: neither when nor kind provided
    res_nokind = client.post(
        "/jobs/preview",
        headers=_auth(api_key),
        json={"content": "Sem agendamento"},
    )
    assert res_nokind.status_code == 422

    # 4. 422: invalid when expression
    res_inv_when = client.post(
        "/jobs/preview",
        headers=_auth(api_key),
        json={"when": "palavra_desconhecida_sem_sentido_algum", "content": "Teste"},
    )
    assert res_inv_when.status_code == 422

    # 5. 404: template_id does not exist
    res_404 = client.post(
        "/jobs/preview",
        headers=_auth(api_key),
        json={"when": "2027-09-12T14:00:00-03:00", "template_id": "non-existent-template"},
    )
    assert res_404.status_code == 404


def test_preview_job_greetings_and_dynamic_variables(
    client: TestClient, api_key: str
) -> None:
    # 09:30 local -> "Bom dia", "manhã"
    payload = {
        "when": "2027-09-15T09:30:00-03:00",
        "content": (
            "{{greeting}}, seu aviso das {{hour}}:{{minute}} no dia {{day}}/{{month}} ({{period}})."
        ),
        "to": "eu",
        "title": "Aviso Matinal",
    }
    res = client.post("/jobs/preview", headers=_auth(api_key), json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["rendered_content"] == "Bom dia, seu aviso das 09:30 no dia 15/09 (manhã)."
    assert body["variables"]["greeting"] == "Bom dia"
    assert body["variables"]["greeting_lower"] == "bom dia"
    assert body["variables"]["saudacao"] == "Bom dia"
    assert body["variables"]["period"] == "manhã"
    assert body["variables"]["day"] == "15"
    assert body["variables"]["month"] == "09"
    assert body["variables"]["hour"] == "09"
    assert body["variables"]["minute"] == "30"


def test_retry_job_auth_and_errors(
    client: TestClient, app: FastAPI, api_key: str
) -> None:
    res_401 = client.post("/jobs/some-id/retry")
    assert res_401.status_code == 401

    res_404 = client.post("/jobs/non-existent/retry", headers=_auth(api_key))
    assert res_404.status_code == 404

    # YAML job is 409
    repo = app.state.repo
    yaml_job = Job(
        id="yaml-routine-1",
        title="Routine",
        content="Hello",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.CRON,
        cron_expr="0 9 * * 1",
        source=JobSource.YAML,
        status=JobStatus.ERROR,
        last_error="gateway down",
        retry_count=3,
    )
    repo.insert(yaml_job)
    res_409 = client.post(f"/jobs/{yaml_job.id}/retry", headers=_auth(api_key))
    assert res_409.status_code == 409


def test_retry_once_job_dead_letter(
    client: TestClient, app: FastAPI, api_key: str
) -> None:
    repo: JobRepository = app.state.repo
    # Future job: remains scheduled without immediate tick execution
    job_future = Job(
        id="dead-once-future",
        title="Dead Once Future",
        content="Pagar boleto",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2027, 9, 10, 12, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.ERROR,
        enabled=False,
        next_run_at=None,
        last_error="422 Unprocessable Entity",
        retry_count=3,
    )
    repo.insert(job_future)

    res = client.post(f"/jobs/{job_future.id}/retry", headers=_auth(api_key))
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "scheduled"
    assert data["enabled"] is True
    assert data["retry_count"] == 0
    assert data["last_error"] is None
    assert data["next_run_at"] is not None

    persisted = repo.get(job_future.id)
    assert persisted is not None
    assert persisted.status == JobStatus.SCHEDULED
    assert persisted.enabled is True
    assert persisted.retry_count == 0
    assert persisted.last_error is None


def test_retry_cron_job_dead_letter(
    client: TestClient, app: FastAPI, api_key: str
) -> None:
    repo: JobRepository = app.state.repo
    job = Job(
        id="dead-cron-1",
        title="Dead Cron",
        content="Rotina semanal",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.CRON,
        cron_expr="0 9 * * 1",
        source=JobSource.SQLITE,
        status=JobStatus.ERROR,
        enabled=False,
        last_error="gateway 500 error",
        retry_count=3,
    )
    repo.insert(job)

    res = client.post(f"/jobs/{job.id}/retry", headers=_auth(api_key))
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "scheduled"
    assert data["enabled"] is True
    assert data["retry_count"] == 0
    assert data["last_error"] is None
    assert data["next_run_at"] is not None


def test_retry_group_dead_letter(
    client: TestClient, app: FastAPI, api_key: str
) -> None:
    repo: JobRepository = app.state.repo
    group_id = "grp_dead_test"
    j1 = Job(
        id="grp-j1",
        title="Aviso 1",
        content="Msg 1",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2027, 9, 10, 10, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.ERROR,
        enabled=False,
        last_error="422 Invalid",
        retry_count=3,
        group_id=group_id,
    )
    j2 = Job(
        id="grp-j2",
        title="Aviso 2",
        content="Msg 2",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2027, 9, 10, 10, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.DONE,
        enabled=False,
        last_status="queued",
        retry_count=0,
        group_id=group_id,
    )
    j3 = Job(
        id="grp-j3",
        title="Aviso 3",
        content="Msg 3",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2027, 9, 10, 10, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.ERROR,
        enabled=False,
        last_error="401 Unauthorized",
        retry_count=1,
        group_id=group_id,
    )
    repo.insert(j1)
    repo.insert(j2)
    repo.insert(j3)

    res = client.post(f"/jobs/group/{group_id}/retry", headers=_auth(api_key))
    assert res.status_code == 200
    body = res.json()
    assert body["group_id"] == group_id
    assert body["affected"] == 2
    assert body["status"] == "scheduled"

    # Verify j1 and j3 are now scheduled, j2 remains done
    assert repo.get("grp-j1").status == JobStatus.SCHEDULED  # type: ignore[union-attr]
    assert repo.get("grp-j1").retry_count == 0  # type: ignore[union-attr]
    assert repo.get("grp-j2").status == JobStatus.DONE  # type: ignore[union-attr]
    assert repo.get("grp-j3").status == JobStatus.SCHEDULED  # type: ignore[union-attr]
    assert repo.get("grp-j3").retry_count == 0  # type: ignore[union-attr]


def test_run_now_on_error_once_job_transitions_to_done(
    client: TestClient, app: FastAPI, api_key: str
) -> None:
    repo: JobRepository = app.state.repo
    job = Job(
        id="dead-run-now-1",
        title="Dead Run Now",
        content="Mensagem imediata",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2026, 9, 10, 12, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.ERROR,
        enabled=False,
        last_error="failed before",
        retry_count=3,
    )
    repo.insert(job)

    run_res = client.post(f"/jobs/{job.id}/run", headers=_auth(api_key))
    assert run_res.status_code == 202
    assert run_res.json() == {"status": "queued", "job_id": job.id}

    persisted = repo.get(job.id)
    assert persisted is not None
    assert persisted.status == JobStatus.DONE
    assert persisted.enabled is False
    assert persisted.last_error is None
    assert persisted.retry_count == 0
    assert persisted.last_status == "queued"


def test_job_list_item_includes_last_error_and_retry_count(
    client: TestClient, app: FastAPI, api_key: str
) -> None:
    repo: JobRepository = app.state.repo
    job = Job(
        id="inspect-err-1",
        title="Inspect Error",
        content="Texto",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2026, 9, 10, 12, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.ERROR,
        enabled=False,
        last_error="Permanent error 422",
        retry_count=3,
    )
    repo.insert(job)

    res = client.get("/jobs?status=error", headers=_auth(api_key))
    assert res.status_code == 200
    jobs = res.json()["jobs"]
    matching = [j for j in jobs if j["id"] == "inspect-err-1"]
    assert len(matching) == 1
    assert matching[0]["last_error"] == "Permanent error 422"
    assert matching[0]["retry_count"] == 3


def test_get_job_runs_and_all_runs_endpoints(
    client: TestClient, app: FastAPI, api_key: str
) -> None:
    # 401 without key
    assert client.get("/jobs/runs").status_code == 401
    assert client.get("/jobs/fake-id/runs").status_code == 401

    # 404 for unknown job
    assert client.get("/jobs/non-existent/runs", headers=_auth(api_key)).status_code == 404

    # Create a job and run it
    repo: JobRepository = app.state.repo
    job = Job(
        id="run-api-job-1",
        title="Run API Job",
        content="Test runs endpoint",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2027, 9, 20, 10, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.SCHEDULED,
    )
    repo.insert(job)

    # Initially 0 runs
    res = client.get(f"/jobs/{job.id}/runs", headers=_auth(api_key))
    assert res.status_code == 200
    assert res.json() == {"runs": []}

    # Trigger manual run
    run_res = client.post(f"/jobs/{job.id}/run", headers=_auth(api_key))
    assert run_res.status_code == 202

    # Now 1 run exists
    res = client.get(f"/jobs/{job.id}/runs", headers=_auth(api_key))
    assert res.status_code == 200
    runs = res.json()["runs"]
    assert len(runs) == 1
    assert runs[0]["job_id"] == job.id
    assert runs[0]["trigger"] == "manual"
    assert runs[0]["status"] == "success"
    assert runs[0]["status_code"] == 202
    assert "duration_ms" in runs[0]

    # Global runs endpoint
    all_runs_res = client.get("/jobs/runs", headers=_auth(api_key))
    assert all_runs_res.status_code == 200
    all_runs = all_runs_res.json()["runs"]
    assert any(r["job_id"] == job.id for r in all_runs)

    # Filtered by status
    filtered = client.get("/jobs/runs?status=success", headers=_auth(api_key))
    assert filtered.status_code == 200
    assert any(r["job_id"] == job.id for r in filtered.json()["runs"])

    filtered_err = client.get("/jobs/runs?status=error", headers=_auth(api_key))
    assert filtered_err.status_code == 200
    assert not any(r["job_id"] == job.id for r in filtered_err.json()["runs"])


def test_manual_run_failure_records_error_job_run(
    client: TestClient, app: FastAPI, api_key: str, dispatcher: RecordingDispatcher
) -> None:
    dispatcher.status_code = 500
    repo: JobRepository = app.state.repo
    job = Job(
        id="run-fail-job-1",
        title="Run Fail Job",
        content="Fail me",
        to="eu",
        target_number="5511999998888@c.us",
        kind=JobKind.ONCE,
        run_at=datetime(2027, 9, 20, 10, 0, tzinfo=UTC),
        source=JobSource.SQLITE,
        status=JobStatus.SCHEDULED,
    )
    repo.insert(job)

    run_res = client.post(f"/jobs/{job.id}/run", headers=_auth(api_key))
    assert run_res.status_code == 502

    runs_res = client.get(f"/jobs/{job.id}/runs", headers=_auth(api_key))
    assert runs_res.status_code == 200
    runs = runs_res.json()["runs"]
    assert len(runs) == 1
    assert runs[0]["trigger"] == "manual"
    assert runs[0]["status"] == "error"
    assert runs[0]["error_message"] is not None


def test_create_job_with_variables_and_dispatch(
    client: TestClient, api_key: str, dispatcher: RecordingDispatcher
) -> None:
    res = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Consulta Marcada",
            "content": "Olá {{name}}, consulta com {{medico}}. Protocolo: {{protocolo}}.",
            "to": "5511999998888@c.us",
            "kind": "once",
            "run_at": "2027-09-25T14:00:00-03:00",
            "variables": {"medico": "Dr. House", "protocolo": "HOUSE-123"},
        },
    )
    assert res.status_code == 201
    job_data = res.json()
    assert job_data["variables"] == {"medico": "Dr. House", "protocolo": "HOUSE-123"}
    job_id = job_data["id"]

    # Verify GET /jobs/{id}
    get_res = client.get(f"/jobs/{job_id}", headers=_auth(api_key))
    assert get_res.status_code == 200
    assert get_res.json()["variables"] == {"medico": "Dr. House", "protocolo": "HOUSE-123"}

    # Verify GET /jobs list includes variables
    list_res = client.get("/jobs?status=upcoming", headers=_auth(api_key))
    assert list_res.status_code == 200
    items = [j for j in list_res.json()["jobs"] if j["id"] == job_id]
    assert len(items) == 1
    assert items[0]["variables"] == {"medico": "Dr. House", "protocolo": "HOUSE-123"}

    # Run now and verify rendered message sent to gateway
    run_res = client.post(f"/jobs/{job_id}/run", headers=_auth(api_key))
    assert run_res.status_code == 202
    assert len(dispatcher.calls) == 1
    phone, content = dispatcher.calls[0]
    assert phone == "5511999998888@c.us"
    assert "consulta com Dr. House. Protocolo: HOUSE-123." in content


def test_batch_jobs_with_variables(client: TestClient, api_key: str) -> None:
    res = client.post(
        "/jobs/batch",
        headers=_auth(api_key),
        json={
            "title": "Aviso da Turma",
            "content": "Aviso para a turma {{turma}}.",
            "recipients": ["5511999991111", "5511999992222"],
            "kind": "once",
            "run_at": "2027-09-25T14:00:00-03:00",
            "variables": {"turma": "Engenharia 3A"},
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["count"] == 2
    for j in data["jobs"]:
        assert j["variables"] == {"turma": "Engenharia 3A"}


def test_preview_job_with_variables(client: TestClient, api_key: str) -> None:
    res = client.post(
        "/jobs/preview",
        headers=_auth(api_key),
        json={
            "when": "amanhã 14h",
            "content": "Seu código é {{codigo}} para {{date}}.",
            "to": "eu",
            "variables": {"codigo": "SEC-8899"},
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "Seu código é SEC-8899" in data["rendered_content"]
    assert data["variables"]["codigo"] == "SEC-8899"
    assert "date" in data["variables"]
    assert "greeting" in data["variables"]


def test_job_create_with_until_and_max_runs(client: TestClient, api_key: str) -> None:
    until = (datetime.now(UTC) + timedelta(days=30)).isoformat()
    res = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Recorrente com limites",
            "content": "Aviso limitado",
            "to": "eu",
            "kind": "cron",
            "cron_expr": "0 10 * * *",
            "until": until,
            "max_runs": 5,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["max_runs"] == 5
    assert data["run_count"] == 0
    assert data["until"] is not None

    job_id = data["id"]
    get_res = client.get(f"/jobs/{job_id}", headers=_auth(api_key))
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["max_runs"] == 5
    assert detail["run_count"] == 0
    assert detail["until"] is not None


def test_job_lifecycle_pause_and_resume(client: TestClient, api_key: str) -> None:
    res = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Job para pausar",
            "content": "Conteúdo teste",
            "to": "eu",
            "kind": "cron",
            "cron_expr": "0 8 * * *",
        },
    )
    assert res.status_code == 201
    job_id = res.json()["id"]

    # Pause
    pause_res = client.post(f"/jobs/{job_id}/pause", headers=_auth(api_key))
    assert pause_res.status_code == 200
    paused_job = pause_res.json()
    assert paused_job["status"] == "paused"
    assert paused_job["enabled"] is False

    # Pausing again should 409
    pause_again = client.post(f"/jobs/{job_id}/pause", headers=_auth(api_key))
    assert pause_again.status_code == 409

    # Resume
    resume_res = client.post(f"/jobs/{job_id}/resume", headers=_auth(api_key))
    assert resume_res.status_code == 200
    resumed_job = resume_res.json()
    assert resumed_job["status"] == "scheduled"
    assert resumed_job["enabled"] is True
    assert resumed_job["next_run_at"] is not None

    # Resuming again should 409
    resume_again = client.post(f"/jobs/{job_id}/resume", headers=_auth(api_key))
    assert resume_again.status_code == 409


def test_job_lifecycle_snooze(client: TestClient, api_key: str) -> None:
    res = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Job para adiar",
            "content": "Conteúdo teste",
            "to": "eu",
            "kind": "cron",
            "cron_expr": "0 8 * * *",
        },
    )
    assert res.status_code == 201
    job_id = res.json()["id"]

    # Snooze to future
    future_time = datetime.now(UTC) + timedelta(hours=5)
    snooze_res = client.post(
        f"/jobs/{job_id}/snooze",
        headers=_auth(api_key),
        json={"until": future_time.isoformat()},
    )
    assert snooze_res.status_code == 200
    snoozed_job = snooze_res.json()
    assert snoozed_job["status"] == "scheduled"
    assert snoozed_job["cron_expr"] == "0 8 * * *"
    assert snoozed_job["next_run_at"] is not None

    # Snooze to past should return 422
    past_time = datetime.now(UTC) - timedelta(hours=1)
    bad_snooze = client.post(
        f"/jobs/{job_id}/snooze",
        headers=_auth(api_key),
        json={"until": past_time.isoformat()},
    )
    assert bad_snooze.status_code == 422


def test_group_lifecycle_pause_resume_snooze(client: TestClient, api_key: str) -> None:
    batch = client.post(
        "/jobs/batch",
        headers=_auth(api_key),
        json={
            "recipients": ["5511999991111", "5511999992222"],
            "title": "Grupo Ciclo de Vida",
            "content": "Aviso em lote",
            "kind": "cron",
            "cron_expr": "0 9 * * *",
        },
    ).json()
    group_id = batch["group_id"]

    # Pause group
    pause_res = client.post(f"/jobs/group/{group_id}/pause", headers=_auth(api_key))
    assert pause_res.status_code == 200
    assert pause_res.json()["affected"] == 2

    for job_summary in batch["jobs"]:
        j = client.get(f"/jobs/{job_summary['id']}", headers=_auth(api_key)).json()
        assert j["status"] == "paused"
        assert j["enabled"] is False

    # Resume group
    resume_res = client.post(f"/jobs/group/{group_id}/resume", headers=_auth(api_key))
    assert resume_res.status_code == 200
    assert resume_res.json()["affected"] == 2

    for job_summary in batch["jobs"]:
        j = client.get(f"/jobs/{job_summary['id']}", headers=_auth(api_key)).json()
        assert j["status"] == "scheduled"
        assert j["enabled"] is True

    # Snooze group
    snooze_time = datetime.now(UTC) + timedelta(hours=3)
    snooze_res = client.post(
        f"/jobs/group/{group_id}/snooze",
        headers=_auth(api_key),
        json={"until": snooze_time.isoformat()},
    )
    assert snooze_res.status_code == 200
    assert snooze_res.json()["affected"] == 2


def test_yaml_job_lifecycle_mutations_rejected(
    client: TestClient,
    api_key: str,
    tmp_path: Path,
) -> None:
    from homelab_schedule.store import connect

    # Insert a fake YAML job directly into DB
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    repo.insert(
        Job(
            id="routine-daily",
            title="Rotina Diária",
            content="Texto rotina",
            to="eu",
            target_number="5511999998888@c.us",
            kind=JobKind.CRON,
            cron_expr="0 8 * * *",
            source=JobSource.YAML,
            status=JobStatus.SCHEDULED,
            enabled=True,
            created_by="system",
        )
    )
    conn.close()

    pause_res = client.post("/jobs/routine-daily/pause", headers=_auth(api_key))
    assert pause_res.status_code == 409

    resume_res = client.post("/jobs/routine-daily/resume", headers=_auth(api_key))
    assert resume_res.status_code == 409

    future_time = datetime.now(UTC) + timedelta(hours=2)
    snooze_res = client.post(
        "/jobs/routine-daily/snooze",
        headers=_auth(api_key),
        json={"until": future_time.isoformat()},
    )
    assert snooze_res.status_code == 409




