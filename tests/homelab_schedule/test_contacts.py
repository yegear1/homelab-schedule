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
def app(tmp_path: Path, api_key: str) -> FastAPI:
    settings = Settings(
        schedule_api_key=api_key,
        database_path=str(tmp_path / "schedule.sqlite"),
        whatsapp_aliases="eu=5511999998888@c.us",
        routines_path=str(tmp_path / "routines.yaml"),
        _env_file=None,
    )
    return create_app(settings, dispatcher=RecordingDispatcher())


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def _auth(api_key: str) -> dict[str, str]:
    return {"x-api-key": api_key}


def test_contacts_require_key(client: TestClient) -> None:
    assert client.get("/contacts").status_code == 401


def test_create_list_get_contact(client: TestClient, api_key: str) -> None:
    created = client.post(
        "/contacts",
        headers=_auth(api_key),
        json={"name": "Mae", "phone": "5521999887766"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Mae"
    assert body["phone"] == "5521999887766@c.us"
    listed = client.get("/contacts", headers=_auth(api_key))
    assert listed.status_code == 200
    assert len(listed.json()["contacts"]) == 1
    detail = client.get(f"/contacts/{body['id']}", headers=_auth(api_key))
    assert detail.status_code == 200
    assert detail.json()["id"] == body["id"]


def test_duplicate_phone_is_409(client: TestClient, api_key: str) -> None:
    payload = {"name": "Ana", "phone": "5511999990000"}
    first = client.post("/contacts", headers=_auth(api_key), json=payload)
    assert first.status_code == 201
    second = client.post(
        "/contacts",
        headers=_auth(api_key),
        json={"name": "Outra", "phone": "5511999990000"},
    )
    assert second.status_code == 409


def test_patch_and_delete_contact(client: TestClient, api_key: str) -> None:
    created = client.post(
        "/contacts",
        headers=_auth(api_key),
        json={"name": "Joao", "phone": "5511988887777"},
    )
    contact_id = created.json()["id"]
    patched = client.patch(
        f"/contacts/{contact_id}",
        headers=_auth(api_key),
        json={"name": "Joao Silva"},
    )
    assert patched.status_code == 200
    assert patched.json()["name"] == "Joao Silva"
    deleted = client.delete(f"/contacts/{contact_id}", headers=_auth(api_key))
    assert deleted.status_code == 204
    missing = client.get(f"/contacts/{contact_id}", headers=_auth(api_key))
    assert missing.status_code == 404


def test_delete_blocked_when_scheduled_job(client: TestClient, api_key: str) -> None:
    created = client.post(
        "/contacts",
        headers=_auth(api_key),
        json={"name": "Lia", "phone": "5511911112222"},
    )
    contact_id = created.json()["id"]
    job = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "x",
            "content": "y",
            "to": "Lia",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    )
    assert job.status_code == 201
    assert job.json()["target_number"] == "5511911112222@c.us"
    blocked = client.delete(f"/contacts/{contact_id}", headers=_auth(api_key))
    assert blocked.status_code == 409


def test_job_to_uses_contact_before_alias(client: TestClient, api_key: str) -> None:
    client.post(
        "/contacts",
        headers=_auth(api_key),
        json={"name": "eu", "phone": "5521900001111"},
    )
    job = client.post(
        "/jobs",
        headers=_auth(api_key),
        json={
            "title": "x",
            "content": "y",
            "to": "eu",
            "kind": "once",
            "run_at": "2027-09-12T14:00:00-03:00",
        },
    )
    assert job.status_code == 201
    assert job.json()["target_number"] == "5521900001111@c.us"
