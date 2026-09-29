from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from homelab_schedule.config import Settings
from homelab_schedule.main import create_app
from homelab_schedule.store import APP_TZ
from tests.homelab_schedule.fakes import RecordingDispatcher


@pytest.fixture
def api_key() -> str:
    return "test-digest-key"


@pytest.fixture
def dispatcher() -> RecordingDispatcher:
    return RecordingDispatcher()


@pytest.fixture
def app(tmp_path: Path, api_key: str, dispatcher: RecordingDispatcher) -> FastAPI:
    settings = Settings(
        schedule_api_key=api_key,
        database_path=str(tmp_path / "schedule.sqlite"),
        whatsapp_aliases="eu=5511999998888@c.us,amigo=5511988887777@c.us",
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


def test_daily_digest_requires_auth(client: TestClient) -> None:
    response = client.get("/jobs/digest")
    assert response.status_code == 401


def test_daily_digest_empty(client: TestClient, api_key: str) -> None:
    response = client.get("/jobs/digest?date=hoje", headers=_auth(api_key))
    assert response.status_code == 200
    data = response.json()
    assert data["total_jobs"] == 0
    assert data["jobs"] == []
    assert data["conflicts"] == []
    assert "sem conflitos" in data["summary"]


def test_daily_digest_invalid_date_returns_422(client: TestClient, api_key: str) -> None:
    response = client.get("/jobs/digest?date=data_invalida_xyz", headers=_auth(api_key))
    assert response.status_code == 422


def test_daily_digest_with_jobs_and_conflict_detection(
    client: TestClient, api_key: str
) -> None:
    # 2 jobs for same recipient (eu) with 2 minutes delta -> conflict
    today = datetime.now(APP_TZ).date()
    dt1 = datetime(today.year, today.month, today.day, 20, 0, 0, tzinfo=APP_TZ)
    dt2 = datetime(today.year, today.month, today.day, 20, 2, 0, tzinfo=APP_TZ)
    # 1 job for different recipient at 20:00 -> not a conflict with the other recipient
    # 1 job for eu at 22:00 -> no conflict (delta > 5 min)
    dt3 = datetime(today.year, today.month, today.day, 20, 0, 0, tzinfo=APP_TZ)
    dt4 = datetime(today.year, today.month, today.day, 22, 0, 0, tzinfo=APP_TZ)

    client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Remédio Manhã",
            "content": "Tomar remédio",
            "to": "eu",
            "kind": "once",
            "run_at": dt1.isoformat(),
        },
    )
    client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Aviso Urgente",
            "content": "Aviso rápido",
            "to": "eu",
            "kind": "once",
            "run_at": dt2.isoformat(),
        },
    )
    client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Mensagem Amigo",
            "content": "Olá amigo",
            "to": "amigo",
            "kind": "once",
            "run_at": dt3.isoformat(),
        },
    )
    client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Reunião Tarde",
            "content": "Reunião de alinhamento",
            "to": "eu",
            "kind": "once",
            "run_at": dt4.isoformat(),
        },
    )

    # Global daily digest for today
    res = client.get("/jobs/digest?date=hoje", headers=_auth(api_key))
    assert res.status_code == 200
    data = res.json()
    assert data["total_jobs"] == 4
    assert len(data["jobs"]) == 4

    # Check conflicts: exactly 1 conflict between Remédio Manhã and Aviso Urgente
    assert len(data["conflicts"]) == 1
    conflict = data["conflicts"][0]
    assert conflict["delta_minutes"] == 2
    assert "Remédio Manhã" in conflict["titles"]
    assert "Aviso Urgente" in conflict["titles"]
    assert "2 mensagens agendadas" in conflict["details"]

    # Filtered daily digest for amigo
    res_amigo = client.get("/jobs/digest?date=hoje&phone=amigo", headers=_auth(api_key))
    assert res_amigo.status_code == 200
    data_amigo = res_amigo.json()
    assert data_amigo["total_jobs"] == 1
    assert data_amigo["jobs"][0]["title"] == "Mensagem Amigo"
    assert data_amigo["conflicts"] == []


def test_preview_preventive_conflict_detection(
    client: TestClient, api_key: str
) -> None:
    today = datetime.now(APP_TZ).date()
    dt_existing = datetime(today.year, today.month, today.day, 14, 0, 0, tzinfo=APP_TZ)

    # Create an existing job for 'eu'
    client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "Aluguel",
            "content": "Pagar aluguel",
            "to": "eu",
            "kind": "once",
            "run_at": dt_existing.isoformat(),
        },
    )

    # Preview a new job for 'eu' at 14:02 (2 minutes difference -> overlap!)
    dt_new = datetime(today.year, today.month, today.day, 14, 2, 0, tzinfo=APP_TZ)
    res_preview = client.post(
        "/jobs/preview",
        headers=_auth(api_key),
        json={
            "when": dt_new.isoformat(),
            "content": "Lembrete energia",
            "to": "eu",
            "title": "Energia",
        },
    )
    assert res_preview.status_code == 200
    prev_data = res_preview.json()
    assert "conflicts" in prev_data
    assert len(prev_data["conflicts"]) == 1
    conflict = prev_data["conflicts"][0]
    assert conflict["titles"] == ["Aluguel"]
    assert conflict["delta_minutes"] == 2
    assert "Conflito preventivo" in conflict["details"]

    # Preview a job for 'amigo' at 14:02 -> no conflict
    res_amigo = client.post(
        "/jobs/preview",
        headers=_auth(api_key),
        json={
            "when": dt_new.isoformat(),
            "content": "Para amigo",
            "to": "amigo",
            "title": "Amigo",
        },
    )
    assert res_amigo.status_code == 200
    assert res_amigo.json()["conflicts"] == []
