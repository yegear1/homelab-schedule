import os
import time
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from homelab_schedule.config import Settings
from homelab_schedule.main import create_app
from homelab_schedule.repository import JobRepository
from homelab_schedule.store import connect
from homelab_schedule.tick import run_tick
from tests.homelab_schedule.fakes import RecordingDispatcher


@pytest.fixture
def api_key() -> str:
    return "test-schedule-key"


@pytest.fixture
def dispatcher() -> RecordingDispatcher:
    return RecordingDispatcher()


@pytest.fixture
def routines_file(tmp_path: Path) -> Path:
    f = tmp_path / "routines.yaml"
    f.write_text(
        "- id: backup\n"
        "  title: Backup\n"
        "  content: Rodar backup\n"
        "  to: eu\n"
        "  when: '0 9 * * 1'\n",
        encoding="utf-8",
    )
    return f


@pytest.fixture
def app(
    tmp_path: Path, routines_file: Path, api_key: str, dispatcher: RecordingDispatcher
) -> FastAPI:
    settings = Settings(
        schedule_api_key=api_key,
        database_path=str(tmp_path / "schedule.sqlite"),
        whatsapp_aliases="eu=5511999998888@c.us",
        routines_path=str(routines_file),
        _env_file=None,
    )
    return create_app(settings, dispatcher=dispatcher)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def test_reload_routines_endpoint_requires_auth(client: TestClient) -> None:
    response = client.post("/routines/reload")
    assert response.status_code == 401


def test_reload_routines_endpoint_updates_database(
    client: TestClient, app: FastAPI, routines_file: Path, api_key: str
) -> None:
    headers = {"x-api-key": api_key}
    # Initially 1 routine exists (backup)
    repo = JobRepository(app.state.conn)
    assert repo.get("backup") is not None

    # Update routines.yaml to add a new routine and edit existing
    routines_file.write_text(
        "- id: backup\n"
        "  title: Backup Semanal\n"
        "  content: Rodar backup completo\n"
        "  to: eu\n"
        "  when: '0 10 * * 1'\n"
        "- id: checklist\n"
        "  title: Checklist Diário\n"
        "  content: Revisar servidores\n"
        "  to: eu\n"
        "  when: '0 8 * * *'\n",
        encoding="utf-8",
    )

    response = client.post("/routines/reload", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "reloaded"
    assert data["count"] == 2

    updated_backup = repo.get("backup")
    assert updated_backup is not None
    assert updated_backup.title == "Backup Semanal"

    new_checklist = repo.get("checklist")
    assert new_checklist is not None
    assert new_checklist.title == "Checklist Diário"


@pytest.mark.anyio
async def test_tick_reloads_routines_on_mtime_change(tmp_path: Path) -> None:
    import asyncio

    db = tmp_path / "tick_routines.sqlite"
    routines = tmp_path / "tick_routines.yaml"
    routines.write_text(
        "- id: r1\n"
        "  title: R1\n"
        "  content: First\n"
        "  to: eu\n"
        "  when: '0 9 * * 1'\n",
        encoding="utf-8",
    )

    conn = connect(str(db))
    repo = JobRepository(conn)
    stop = asyncio.Event()
    wake = asyncio.Event()
    dispatcher = RecordingDispatcher()

    # Initial merge
    from homelab_schedule.routines import merge_routines

    merge_routines(repo, routines)
    assert repo.get("r1") is not None

    task = asyncio.create_task(
        run_tick(
            stop=stop,
            wake=wake,
            repo=repo,
            dispatcher=dispatcher,
            aliases={"eu": "5511999998888@c.us"},
            now=lambda: datetime(2026, 9, 11, 12, 0, tzinfo=UTC),
            cap_seconds=60.0,
            routines_path=routines,
        )
    )

    # Let tick start
    await asyncio.sleep(0.05)

    # Modify file and bump mtime
    routines.write_text(
        "- id: r1\n"
        "  title: R1 Updated\n"
        "  content: First\n"
        "  to: eu\n"
        "  when: '0 9 * * 1'\n",
        encoding="utf-8",
    )
    new_mtime = time.time() + 10
    os.utime(routines, (new_mtime, new_mtime))

    # Wake tick
    wake.set()
    await asyncio.sleep(0.05)

    updated = repo.get("r1")
    assert updated is not None
    assert updated.title == "R1 Updated"

    stop.set()
    wake.set()
    await task
    conn.close()
