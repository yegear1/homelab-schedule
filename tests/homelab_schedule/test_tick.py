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


@pytest.mark.anyio
async def test_fire_due_uses_persisted_target_number(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    overdue = datetime(2026, 9, 7, 12, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="persisted-target",
            title="status",
            content="Teste target.",
            to="desconhecido",
            target_number="5511912345678@c.us",
            kind=JobKind.ONCE,
            run_at=overdue,
            next_run_at=overdue,
            status=JobStatus.SCHEDULED,
        )
    )
    dispatcher = RecordingDispatcher()
    now = datetime(2026, 9, 7, 13, 0, tzinfo=UTC)
    failed = await fire_due(repo, dispatcher, {}, now)
    assert failed is False
    assert len(dispatcher.calls) == 1
    assert dispatcher.calls[0][0] == "5511912345678@c.us"
    conn.close()


@pytest.mark.anyio
async def test_fire_due_renders_dynamic_template(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    # 2026-09-11 15:00 UTC -> 12:00 in America/Sao_Paulo
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="template-job",
            title="template test",
            content="Alerta de {{day_name}} do dia {{date}} às {{time}}.",
            to="eu",
            target_number="5511999998888@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    dispatcher = RecordingDispatcher()
    failed = await fire_due(repo, dispatcher, {}, now)
    assert failed is False
    assert len(dispatcher.calls) == 1
    phone, sent_content = dispatcher.calls[0]
    assert phone == "5511999998888@c.us"
    assert sent_content == "Alerta de sexta-feira do dia 11/09/2026 às 12:00."

    # Verify that stored job content remains intact (with templates)
    stored = repo.get("template-job")
    assert stored is not None
    assert stored.content == "Alerta de {{day_name}} do dia {{date}} às {{time}}."
    conn.close()


@pytest.mark.anyio
async def test_fire_due_renders_name_and_live_catalog(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="named-job",
            title="named",
            content="snapshot {{name}}",
            to="eu",
            target_number="5521999887766@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
            template_id="tpl-1",
        )
    )
    dispatcher = RecordingDispatcher()
    failed = await fire_due(
        repo,
        dispatcher,
        {},
        now,
        dest_name=lambda phone: "Mae" if phone == "5521999887766@c.us" else None,
        template_body=lambda tid: "Oi {{name}}." if tid == "tpl-1" else None,
    )
    assert failed is False
    assert dispatcher.calls[0][1] == "Oi Mae."
    conn.close()


@pytest.mark.anyio
async def test_fire_due_transient_failure_schedules_retry(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="retry-job",
            title="retry test",
            content="Aviso temporario.",
            to="eu",
            target_number="5511999998888@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    # 503 Service Unavailable (transient)
    dispatcher = RecordingDispatcher(status_code=503)

    # 1st failure: retry_count becomes 1, next_run_at = now + 2 min
    failed = await fire_due(repo, dispatcher, {}, now)
    assert failed is True
    job = repo.get("retry-job")
    assert job is not None
    assert job.retry_count == 1
    assert job.status is JobStatus.SCHEDULED
    assert job.enabled is True
    assert job.next_run_at == now + timedelta(minutes=2)

    # 2nd failure: retry_count becomes 2, next_run_at = now + 4 min
    await fire_due(repo, dispatcher, {}, now + timedelta(minutes=2))
    job = repo.get("retry-job")
    assert job is not None
    assert job.retry_count == 2
    assert job.status is JobStatus.SCHEDULED
    assert job.enabled is True
    assert job.next_run_at == (now + timedelta(minutes=2)) + timedelta(minutes=4)

    # 3rd failure: retry_count becomes 3, next_run_at = now + 8 min
    t3 = (now + timedelta(minutes=2)) + timedelta(minutes=4)
    await fire_due(repo, dispatcher, {}, t3)
    job = repo.get("retry-job")
    assert job is not None
    assert job.retry_count == 3
    assert job.status is JobStatus.SCHEDULED

    # 4th failure: exceeds _MAX_RETRIES -> status becomes ERROR, enabled becomes False
    t4 = t3 + timedelta(minutes=8)
    await fire_due(repo, dispatcher, {}, t4)
    job = repo.get("retry-job")
    assert job is not None
    assert job.status is JobStatus.ERROR
    assert job.enabled is False
    assert job.next_run_at is None
    conn.close()


@pytest.mark.anyio
async def test_fire_due_permanent_failure_no_retries(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="perm-job",
            title="perm test",
            content="Aviso permanente.",
            to="eu",
            target_number="5511999998888@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    # 401 Unauthorized (permanent)
    dispatcher = RecordingDispatcher(status_code=401)
    failed = await fire_due(repo, dispatcher, {}, now)
    assert failed is True
    job = repo.get("perm-job")
    assert job is not None
    assert job.status is JobStatus.ERROR
    assert job.enabled is False
    assert job.next_run_at is None
    conn.close()


@pytest.mark.anyio
async def test_fire_due_records_job_run_audit(tmp_path: Path) -> None:
    from schemas.job import JobRunStatus, JobRunTrigger

    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="audit-job",
            title="audit test",
            content="Audit content",
            to="eu",
            target_number="5511999998888@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    dispatcher = RecordingDispatcher(status_code=202)
    failed = await fire_due(repo, dispatcher, {}, now)
    assert failed is False

    runs = repo.list_runs_for_job("audit-job")
    assert len(runs) == 1
    assert runs[0].job_id == "audit-job"
    assert runs[0].trigger == JobRunTrigger.SCHEDULE
    assert runs[0].status == JobRunStatus.SUCCESS
    assert runs[0].status_code == 202
    conn.close()


@pytest.mark.anyio
async def test_fire_due_dead_letter_alert_on_permanent_error(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="perm-dl-job",
            title="Lembrete Importante",
            content="Conteúdo do lembrete.",
            to="cliente",
            target_number="5511999998888@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    # 1st call fails 401 (permanent), 2nd call (alert to admin) succeeds 202
    dispatcher = RecordingDispatcher(status_codes=[401, 202])
    failed = await fire_due(
        repo,
        dispatcher,
        {"admin": "5511888887777@c.us"},
        now,
        admin_recipient="admin",
    )
    assert failed is True

    # 2 calls: first to the target number, second alert to admin
    assert len(dispatcher.calls) == 2
    assert dispatcher.calls[0][0] == "5511999998888@c.us"
    admin_phone, alert_content = dispatcher.calls[1]
    assert admin_phone == "5511888887777@c.us"
    assert "🚨 *[Alerta Dead-Letter]*" in alert_content
    assert "Lembrete Importante" in alert_content
    assert "perm-dl-job" in alert_content
    assert "HTTP 401" in alert_content
    assert "pontual" in alert_content
    assert "Dead-Letter" in alert_content

    stored = repo.get("perm-dl-job")
    assert stored is not None
    assert stored.status is JobStatus.ERROR
    assert stored.enabled is False
    conn.close()


@pytest.mark.anyio
async def test_fire_due_dead_letter_alert_on_max_retries_exhausted(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="retry-dl-job",
            title="Aviso de Pagamento",
            content="Mensagem de teste.",
            to="eu",
            target_number="5511999998888@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    dispatcher = RecordingDispatcher(status_code=503)
    admin_dest = "5511999990000@c.us"

    # Attempt 1, 2, 3: retry scheduled, no alert yet
    t1 = now
    await fire_due(repo, dispatcher, {}, t1, admin_recipient=admin_dest)
    assert len(dispatcher.calls) == 1
    assert repo.get("retry-dl-job").status is JobStatus.SCHEDULED  # type: ignore[union-attr]

    t2 = t1 + timedelta(minutes=2)
    await fire_due(repo, dispatcher, {}, t2, admin_recipient=admin_dest)
    assert len(dispatcher.calls) == 2
    assert repo.get("retry-dl-job").status is JobStatus.SCHEDULED  # type: ignore[union-attr]

    t3 = t2 + timedelta(minutes=4)
    await fire_due(repo, dispatcher, {}, t3, admin_recipient=admin_dest)
    assert len(dispatcher.calls) == 3
    assert repo.get("retry-dl-job").status is JobStatus.SCHEDULED  # type: ignore[union-attr]

    # Attempt 4: exceeds _MAX_RETRIES (3) -> Dead-Letter! Alert should be sent
    # Dispatcher setup: job fails with 503, alert succeeds with 202
    dispatcher.status_codes = [503, 202]
    t4 = t3 + timedelta(minutes=8)
    await fire_due(repo, dispatcher, {}, t4, admin_recipient=admin_dest)
    assert len(dispatcher.calls) == 5  # 3 prior + 1 job fail + 1 alert
    admin_call = dispatcher.calls[-1]
    assert admin_call[0] == "5511999990000@c.us"
    assert "🚨 *[Alerta Dead-Letter]*" in admin_call[1]
    assert "Aviso de Pagamento" in admin_call[1]
    assert "Tentativas:* 4" in admin_call[1]

    stored = repo.get("retry-dl-job")
    assert stored is not None
    assert stored.status is JobStatus.ERROR
    assert stored.enabled is False
    conn.close()


@pytest.mark.anyio
async def test_fire_due_dead_letter_alert_skipped_when_no_admin(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="no-admin-job",
            title="Sem Admin",
            content="Mensagem.",
            to="eu",
            target_number="5511999998888@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    dispatcher = RecordingDispatcher(status_code=401)
    failed = await fire_due(repo, dispatcher, {}, now, admin_recipient=None)
    assert failed is True
    assert len(dispatcher.calls) == 1
    assert dispatcher.calls[0][0] == "5511999998888@c.us"
    conn.close()


@pytest.mark.anyio
async def test_fire_due_dead_letter_alert_with_custom_resolver(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="resolver-job",
            title="Resolver Job",
            content="Mensagem.",
            to="cliente",
            target_number="5511999998888@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    dispatcher = RecordingDispatcher(status_codes=[401, 202])
    failed = await fire_due(
        repo,
        dispatcher,
        {},
        now,
        admin_recipient="Operador Chefe",
        admin_resolver=lambda name: "5521977776666@c.us" if name == "Operador Chefe" else "",
    )
    assert failed is True
    assert len(dispatcher.calls) == 2
    assert dispatcher.calls[1][0] == "5521977776666@c.us"
    conn.close()


@pytest.mark.anyio
async def test_fire_due_dead_letter_alert_gateway_failure_does_not_raise(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="alert-fail-job",
            title="Falha no Alerta",
            content="Mensagem.",
            to="cliente",
            target_number="5511999998888@c.us",
            kind=JobKind.ONCE,
            run_at=now,
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    # Both the job and the alert fail (e.g. 500)
    dispatcher = RecordingDispatcher(status_codes=[401, 500])
    failed = await fire_due(
        repo,
        dispatcher,
        {},
        now,
        admin_recipient="5511999990000@c.us",
    )
    assert failed is True
    assert len(dispatcher.calls) == 2
    stored = repo.get("alert-fail-job")
    assert stored is not None
    assert stored.status is JobStatus.ERROR
    assert stored.enabled is False
    conn.close()


@pytest.mark.anyio
async def test_fire_due_dead_letter_alert_for_cron_job(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    now = datetime(2026, 9, 11, 15, 0, tzinfo=UTC)
    repo.insert(
        Job(
            id="cron-dl-job",
            title="Rotina Recorrente",
            content="Rotina.",
            to="cliente",
            target_number="5511999998888@c.us",
            kind=JobKind.CRON,
            cron_expr="0 9 * * 1",
            next_run_at=now,
            status=JobStatus.SCHEDULED,
        )
    )
    dispatcher = RecordingDispatcher(status_codes=[401, 202])
    failed = await fire_due(
        repo,
        dispatcher,
        {},
        now,
        admin_recipient="5511999990000@c.us",
    )
    assert failed is True
    assert len(dispatcher.calls) == 2
    alert_content = dispatcher.calls[1][1]
    assert "recorrente" in alert_content
    assert "Ocorrência descartada; próximo ciclo agendado." in alert_content

    stored = repo.get("cron-dl-job")
    assert stored is not None
    assert stored.status is JobStatus.SCHEDULED
    assert stored.next_run_at is not None
    assert stored.next_run_at > now
    conn.close()


def test_tick_loop_sends_dead_letter_alert_to_admin(tmp_path: Path, api_key: str) -> None:
    dispatcher = RecordingDispatcher(status_codes=[401, 202])
    settings = Settings(
        schedule_api_key=api_key,
        database_path=str(tmp_path / "schedule.sqlite"),
        whatsapp_aliases="eu=5511999998888@c.us,admin=5511977770000@c.us",
        whatsapp_admin_number="admin",
        routines_path=str(tmp_path / "routines.yaml"),
        _env_file=None,
    )
    app = create_app(settings, dispatcher=dispatcher)
    with TestClient(app) as test_client:
        run_at = datetime.now(UTC) + timedelta(seconds=1)
        created = test_client.post(
            "/jobs",
            headers=_auth(api_key),
            json={
                "title": "Job Que Vai Falhar",
                "content": "Conteúdo falho",
                "kind": "once",
                "run_at": run_at.isoformat(),
            },
        )
        assert created.status_code == 201
        started = time.monotonic()
        deadline = started + 4.0
        while time.monotonic() < deadline and len(dispatcher.calls) < 2:
            time.sleep(0.05)

        assert len(dispatcher.calls) == 2
        # First call was to 'eu' (default recipient)
        assert dispatcher.calls[0][0] == "5511999998888@c.us"
        # Second call was alert to 'admin'
        assert dispatcher.calls[1][0] == "5511977770000@c.us"
        assert "🚨 *[Alerta Dead-Letter]*" in dispatcher.calls[1][1]
        assert "Job Que Vai Falhar" in dispatcher.calls[1][1]


