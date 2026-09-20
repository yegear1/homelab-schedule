from __future__ import annotations

import sqlite3
import tempfile
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from homelab_schedule.config import Settings
from homelab_schedule.dispatch import Dispatcher, DispatchResult
from homelab_schedule.main import create_app


class DummyDispatcher(Dispatcher):
    async def send(
        self,
        *,
        phone_number: str,
        content: str,
    ) -> DispatchResult:
        return DispatchResult(
            ok=True,
            status_code=202,
            last_status="queued",
            last_error=None,
            duration_ms=10.0,
        )


@pytest.fixture
def tmp_db_and_routines(tmp_path: Path) -> tuple[str, str]:
    db = str(tmp_path / "test.db")
    routines = tmp_path / "routines.yaml"
    routines.write_text(
        """
- id: routine-weekly-review
  title: Weekly Review
  content: Review tasks
  to: eu
  when: "0 9 * * 1"
""",
        encoding="utf-8",
    )
    return db, str(routines)


@pytest.fixture
def client(tmp_db_and_routines: tuple[str, str]) -> Iterator[TestClient]:
    db, routines = tmp_db_and_routines
    settings = Settings(
        database_path=db,
        routines_path=routines,
        schedule_api_key="secret-key",
        whatsapp_api_url="http://mock-gw",
        whatsapp_api_key="gw-key",
        whatsapp_aliases="eu:5511999999999",
    )
    app = create_app(
        settings,
        dispatcher=DummyDispatcher(),
        now=lambda: datetime(2026, 9, 19, 12, 0, 0, tzinfo=UTC),
    )
    with TestClient(app) as tc:
        yield tc


def test_backup_endpoints_require_auth(client: TestClient) -> None:
    res = client.get("/backup/database")
    assert res.status_code == 401

    res = client.get("/backup/export")
    assert res.status_code == 401

    res = client.post("/backup/import", json={"mode": "merge"})
    assert res.status_code == 401

    res = client.get("/backup/integrity")
    assert res.status_code == 401


def test_check_integrity(client: TestClient) -> None:
    res = client.get("/backup/integrity", headers={"x-api-key": "secret-key"})
    assert res.status_code == 200
    data = res.json()
    assert data["integrity_ok"] is True
    assert "ok" in data["details"]
    assert data["foreign_keys_ok"] is True
    assert data["fk_violations"] == []


def test_download_database_returns_valid_sqlite(client: TestClient) -> None:
    # First create a contact so database has user data
    c_res = client.post(
        "/contacts",
        headers={"x-api-key": "secret-key"},
        json={"name": "Alice", "phone": "5511999990001"},
    )
    assert c_res.status_code == 201

    res = client.get("/backup/database", headers={"x-api-key": "secret-key"})
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/x-sqlite3"
    assert "attachment; filename=" in res.headers["content-disposition"]
    assert len(res.content) > 0

    # Verify the downloaded content is indeed a valid SQLite database
    with tempfile.NamedTemporaryFile(suffix=".sqlite3") as tmp:
        tmp.write(res.content)
        tmp.flush()
        conn = sqlite3.connect(tmp.name)
        try:
            row = conn.execute("SELECT name, phone FROM contacts WHERE name = 'Alice'").fetchone()
            assert row is not None
            assert row[0] == "Alice"
            assert "5511999990001" in str(row[1])
            integrity = conn.execute("PRAGMA integrity_check").fetchone()
            assert integrity[0] == "ok"
        finally:
            conn.close()


def test_export_and_import_roundtrip(client: TestClient) -> None:
    auth = {"x-api-key": "secret-key"}

    # 1. Create a contact, a template, and a job
    c_res = client.post("/contacts", headers=auth, json={"name": "Bob", "phone": "5511988887777"})
    assert c_res.status_code == 201
    contact_id = c_res.json()["id"]

    t_res = client.post(
        "/templates",
        headers=auth,
        json={"name": "Lembrete", "body": "Oi {{name}}!"},
    )
    assert t_res.status_code == 201
    template_id = t_res.json()["id"]

    j_res = client.post(
        "/jobs",
        headers=auth,
        json={
            "title": "Aviso Bob",
            "content": "Aviso importante",
            "to": "5511988887777",
            "kind": "once",
            "run_at": "2026-09-20T10:00:00Z",
            "variables": {"tipo": "urgente"},
        },
    )
    assert j_res.status_code == 201
    job_id = j_res.json()["id"]

    # Trigger run now to generate a job run
    r_res = client.post(f"/jobs/{job_id}/run", headers=auth)
    assert r_res.status_code == 202

    # 2. Export data
    exp_res = client.get("/backup/export", headers=auth)
    assert exp_res.status_code == 200
    export_payload = exp_res.json()

    assert export_payload["metadata"]["version"] == 1
    assert export_payload["metadata"]["schema_version"] == 9
    assert export_payload["metadata"]["counts"]["contacts"] >= 1
    assert export_payload["metadata"]["counts"]["templates"] >= 1
    assert export_payload["metadata"]["counts"]["jobs"] >= 1
    assert export_payload["metadata"]["counts"]["job_runs"] >= 1

    assert any(c["id"] == contact_id for c in export_payload["contacts"])
    assert any(
        j["id"] == job_id and j["variables"] == {"tipo": "urgente"}
        for j in export_payload["jobs"]
    )
    assert not any(j["id"] == "routine-weekly-review" for j in export_payload["jobs"])

    # 3. Test export with download=true
    exp_dl_res = client.get("/backup/export?download=true", headers=auth)
    assert exp_dl_res.status_code == 200
    assert "attachment; filename=" in exp_dl_res.headers["content-disposition"]

    # 4. Test import in MERGE mode with modified contact name and new template
    import_req = {
        "mode": "merge",
        "contacts": [
            {"id": contact_id, "name": "Bob Silva", "phone": "5511988887777"},
            {"name": "Carlos", "phone": "5511977776666"},
        ],
        "templates": [
            {"id": template_id, "name": "Lembrete", "body": "Oi {{name}}, atualizado!"},
            {"name": "Cobrança", "body": "Prezado {{name}}, favor quitar pendência."},
        ],
        "jobs": [
            {
                "id": job_id,
                "title": "Aviso Bob (Atualizado)",
                "content": "Aviso alterado",
                "to": "5511988887777",
                "kind": "once",
                "run_at": "2026-09-21T10:00:00Z",
                "source": "sqlite",
                "status": "scheduled",
                "variables": {"tipo": "alterado"},
            },
            {
                "title": "Rotina Ignorada",
                "content": "Routine in yaml",
                "to": "eu",
                "kind": "cron",
                "cron_expr": "0 9 * * 1",
                "source": "yaml",  # should be skipped with warning
            },
        ],
        "job_runs": [
            {
                "id": "orphan-run-123",
                "job_id": "non-existent-job-id",
                "ran_at": "2026-09-19T11:00:00Z",
                "trigger": "manual",
                "status": "success",
                "status_code": 202,
                "duration_ms": 15.0,
            }
        ],
    }

    imp_res = client.post("/backup/import", headers=auth, json=import_req)
    assert imp_res.status_code == 200
    imp_data = imp_res.json()

    assert imp_data["status"] == "imported"
    assert imp_data["mode"] == "merge"
    assert imp_data["summary"]["contacts"]["updated"] == 1
    assert imp_data["summary"]["contacts"]["created"] == 1
    assert imp_data["summary"]["templates"]["updated"] == 1
    assert imp_data["summary"]["templates"]["created"] == 1
    assert imp_data["summary"]["jobs"]["updated"] == 1
    assert imp_data["summary"]["jobs"]["skipped"] == 1  # yaml routine skipped
    assert imp_data["summary"]["job_runs"]["skipped"] == 1  # orphan run skipped
    assert len(imp_data["warnings"]) == 2

    # Verify contact update
    updated_c = client.get(f"/contacts/{contact_id}", headers=auth).json()
    assert updated_c["name"] == "Bob Silva"

    # Verify template update
    updated_t = client.get(f"/templates/{template_id}", headers=auth).json()
    assert updated_t["body"] == "Oi {{name}}, atualizado!"

    # Verify job update
    updated_j = client.get(f"/jobs/{job_id}", headers=auth).json()
    assert updated_j["title"] == "Aviso Bob (Atualizado)"
    assert updated_j["variables"] == {"tipo": "alterado"}


def test_import_replace_mode_preserves_yaml_routines(client: TestClient) -> None:
    auth = {"x-api-key": "secret-key"}

    # Insert a contact and a job to be wiped
    client.post("/contacts", headers=auth, json={"name": "OldContact", "phone": "5511900000000"})
    client.post(
        "/jobs",
        headers=auth,
        json={
            "title": "OldJob",
            "content": "To be wiped",
            "to": "5511900000000",
            "kind": "once",
            "run_at": "2026-09-20T10:00:00Z",
        },
    )

    replace_req = {
        "mode": "replace",
        "contacts": [
            {"id": "new-c1", "name": "FreshContact", "phone": "5511911112222"}
        ],
        "templates": [
            {"id": "new-t1", "name": "FreshTemplate", "body": "Olá mundo"}
        ],
        "jobs": [
            {
                "id": "new-j1",
                "title": "FreshJob",
                "content": "Novo job",
                "to": "5511911112222",
                "kind": "once",
                "run_at": "2026-09-22T10:00:00Z",
                "source": "sqlite",
                "status": "scheduled",
                "variables": {"canal": "geral"},
            }
        ],
        "job_runs": [],
    }

    imp_res = client.post("/backup/import", headers=auth, json=replace_req)
    assert imp_res.status_code == 200
    imp_data = imp_res.json()
    assert imp_data["mode"] == "replace"
    assert imp_data["summary"]["contacts"]["created"] == 1
    assert imp_data["summary"]["templates"]["created"] == 1
    assert imp_data["summary"]["jobs"]["created"] == 1

    # Check that OldContact is gone and FreshContact is present
    contacts = client.get("/contacts", headers=auth).json()["contacts"]
    assert len(contacts) == 1
    assert contacts[0]["name"] == "FreshContact"

    # Check that OldJob is gone and FreshJob is present
    jobs = client.get("/jobs?status=all", headers=auth).json()["jobs"]
    job_ids = [j["id"] for j in jobs]
    assert "new-j1" in job_ids
    fresh_j = client.get("/jobs/new-j1", headers=auth).json()
    assert fresh_j["variables"] == {"canal": "geral"}
    # Crucial: The YAML routine must still be present!
    assert "routine-weekly-review" in job_ids
