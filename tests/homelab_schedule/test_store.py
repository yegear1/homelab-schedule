from datetime import UTC, datetime
from pathlib import Path

import pytest
from pydantic import ValidationError

from homelab_schedule.repository import JobRepository
from homelab_schedule.store import SCHEMA_VERSION, connect
from schemas.job import Job, JobKind, JobSource, JobStatus


def test_connect_creates_wal_schema_and_due_index(tmp_path: Path) -> None:
    db = tmp_path / "schedule.sqlite"
    conn = connect(str(db))
    mode = conn.execute("PRAGMA journal_mode").fetchone()
    assert mode is not None
    assert str(mode[0]).lower() == "wal"
    version = conn.execute("PRAGMA user_version").fetchone()
    assert version is not None
    assert int(version[0]) == SCHEMA_VERSION
    columns = {str(row[1]) for row in conn.execute("PRAGMA table_info(jobs)")}
    assert columns >= {
        "id",
        "title",
        "content",
        "to",
        "kind",
        "run_at",
        "cron_expr",
        "enabled",
        "source",
        "status",
        "next_run_at",
        "last_run_at",
        "last_status",
        "last_error",
    }
    indexes = conn.execute("PRAGMA index_list(jobs)").fetchall()
    names = {str(row[1]) for row in indexes}
    assert "idx_jobs_due" in names
    conn.close()


def test_reconnect_existing_file_keeps_schema(tmp_path: Path) -> None:
    db = tmp_path / "schedule.sqlite"
    first = connect(str(db))
    first.close()
    second = connect(str(db))
    version = second.execute("PRAGMA user_version").fetchone()
    assert version is not None
    assert int(version[0]) == SCHEMA_VERSION
    row = second.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='jobs'"
    ).fetchone()
    assert row is not None
    second.close()


def test_insert_and_get_once_job_roundtrip(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "schedule.sqlite"))
    repo = JobRepository(conn)
    run_at = datetime(2026, 9, 12, 17, 0, tzinfo=UTC)
    stored = repo.insert(
        Job(
            id="job-once-1",
            title="condomínio",
            content="Pagar condomínio.",
            to="eu",
            kind=JobKind.ONCE,
            run_at=run_at,
        )
    )
    assert stored.next_run_at == run_at
    loaded = repo.get("job-once-1")
    assert loaded is not None
    assert loaded.title == "condomínio"
    assert loaded.source is JobSource.SQLITE
    assert loaded.status is JobStatus.SCHEDULED
    assert loaded.to == "eu"
    conn.close()


def test_once_job_requires_run_at() -> None:
    with pytest.raises(ValidationError):
        Job(
            id="bad",
            title="x",
            content="y",
            to="eu",
            kind=JobKind.ONCE,
        )


def test_cron_job_requires_five_fields() -> None:
    with pytest.raises(ValidationError):
        Job(
            id="bad-cron",
            title="x",
            content="y",
            to="eu",
            kind=JobKind.CRON,
            cron_expr="0 9 * *",
        )
