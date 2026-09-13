from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from homelab_schedule.config import Settings
from homelab_schedule.main import create_app
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


def test_templates_require_key(client: TestClient) -> None:
    assert client.get("/templates").status_code == 401


def test_create_list_get_patch_template(client: TestClient, api_key: str) -> None:
    created = client.post(
        "/templates",
        headers=_auth(api_key),
        json={"name": "Bom dia", "body": "Oi {{name}}, hoje é {{date}}."},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Bom dia"
    listed = client.get("/templates", headers=_auth(api_key))
    assert listed.status_code == 200
    assert len(listed.json()["templates"]) == 1
    detail = client.get(f"/templates/{body['id']}", headers=_auth(api_key))
    assert detail.status_code == 200
    patched = client.patch(
        f"/templates/{body['id']}",
        headers=_auth(api_key),
        json={"body": "Olá {{name}}."},
    )
    assert patched.status_code == 200
    assert patched.json()["body"] == "Olá {{name}}."
    deleted = client.delete(f"/templates/{body['id']}", headers=_auth(api_key))
    assert deleted.status_code == 204


def test_duplicate_template_name_is_409(client: TestClient, api_key: str) -> None:
    payload = {"name": "Aviso", "body": "x"}
    assert client.post("/templates", headers=_auth(api_key), json=payload).status_code == 201
    second = client.post(
        "/templates",
        headers=_auth(api_key),
        json={"name": "aviso", "body": "y"},
    )
    assert second.status_code == 409


def test_delete_blocked_when_scheduled_job(client: TestClient, api_key: str) -> None:
    created = client.post(
        "/templates",
        headers=_auth(api_key),
        json={"name": "Lembrete", "body": "Pagar {{name}}."},
    )
    template_id = created.json()["id"]
    job = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "x",
            "template_id": template_id,
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    )
    assert job.status_code == 201
    assert job.json()["content"] == "Pagar {{name}}."
    assert job.json()["template_id"] == template_id
    blocked = client.delete(f"/templates/{template_id}", headers=_auth(api_key))
    assert blocked.status_code == 409


def test_job_from_template_renders_name_on_run(
    client: TestClient, dispatcher: RecordingDispatcher, api_key: str
) -> None:
    client.post(
        "/contacts",
        headers=_auth(api_key),
        json={"name": "Mae", "phone": "5521999887766"},
    )
    template = client.post(
        "/templates",
        headers=_auth(api_key),
        json={"name": "Saudacao", "body": "Oi {{name}}, {{date}}."},
    )
    template_id = template.json()["id"]
    job = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "oi",
            "template_id": template_id,
            "to": "Mae",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    )
    job_id = job.json()["id"]
    client.patch(
        f"/templates/{template_id}",
        headers=_auth(api_key),
        json={"body": "Olá {{name}}."},
    )
    response = client.post(f"/jobs/{job_id}/run", headers=_auth(api_key))
    assert response.status_code == 202
    assert dispatcher.calls[0][0] == "5521999887766@c.us"
    assert dispatcher.calls[0][1] == "Olá Mae."


def test_unknown_template_id_is_404(client: TestClient, api_key: str) -> None:
    response = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "x",
            "template_id": "missing-id",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    )
    assert response.status_code == 404
