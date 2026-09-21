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
        "target_number",
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
        "retry_count",
        "created_by",
        "template_id",
    }
    indexes = conn.execute("PRAGMA index_list(jobs)").fetchall()
    names = {str(row[1]) for row in indexes}
    assert "idx_jobs_due" in names
    assert "idx_jobs_phone" in names
    contact_cols = {str(row[1]) for row in conn.execute("PRAGMA table_info(contacts)")}
    assert contact_cols >= {"id", "name", "phone"}
    assert "idx_jobs_template_id" in names
    templates = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='templates'"
    ).fetchone()
    assert templates is not None
    conn.close()


def test_migration_v1_to_v2(tmp_path: Path) -> None:
    import sqlite3
    db = tmp_path / "legacy.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            "to" TEXT NOT NULL,
            kind TEXT NOT NULL,
            run_at TEXT,
            cron_expr TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            next_run_at TEXT,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT
        )
        """
    )
    conn.execute("PRAGMA user_version=1")
    conn.execute(
        """
        INSERT INTO jobs (
            id, title, content, "to", kind, run_at, enabled, source, status
        ) VALUES (
            'j1', 'old job', 'hello', '5511999998888@c.us', 'once',
            '2026-09-12T17:00:00+00:00', 1, 'sqlite', 'scheduled'
        )
        """
    )
    conn.commit()
    conn.close()

    migrated = connect(str(db))
    version = migrated.execute("PRAGMA user_version").fetchone()
    assert version is not None and int(version[0]) == SCHEMA_VERSION
    repo = JobRepository(migrated)
    job = repo.get("j1")
    assert job is not None
    assert job.target_number == "5511999998888@c.us"
    assert job.retry_count == 0
    migrated.close()


def test_migration_v2_to_v3(tmp_path: Path) -> None:
    import sqlite3
    db = tmp_path / "v2.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            "to" TEXT NOT NULL,
            target_number TEXT NOT NULL DEFAULT '',
            kind TEXT NOT NULL,
            run_at TEXT,
            cron_expr TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            next_run_at TEXT,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT
        )
        """
    )
    conn.execute("PRAGMA user_version=2")
    conn.execute(
        """
        INSERT INTO jobs (
            id, title, content, "to", target_number, kind, run_at, enabled, source, status
        ) VALUES (
            'j2', 'v2 job', 'hello v2', 'eu', '5511999998888@c.us', 'once',
            '2026-09-12T17:00:00+00:00', 1, 'sqlite', 'scheduled'
        )
        """
    )
    conn.commit()
    conn.close()

    migrated = connect(str(db))
    version = migrated.execute("PRAGMA user_version").fetchone()
    assert version is not None and int(version[0]) == SCHEMA_VERSION
    repo = JobRepository(migrated)
    job = repo.get("j2")
    assert job is not None
    assert job.retry_count == 0
    migrated.close()


def test_migration_v3_to_v4_creates_contacts(tmp_path: Path) -> None:
    import sqlite3

    db = tmp_path / "v3.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            "to" TEXT NOT NULL,
            target_number TEXT NOT NULL DEFAULT '',
            kind TEXT NOT NULL,
            run_at TEXT,
            cron_expr TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            next_run_at TEXT,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.execute("PRAGMA user_version=3")
    conn.commit()
    conn.close()

    migrated = connect(str(db))
    version = migrated.execute("PRAGMA user_version").fetchone()
    assert version is not None and int(version[0]) == SCHEMA_VERSION
    row = migrated.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='contacts'"
    ).fetchone()
    assert row is not None
    migrated.close()


def test_migration_v4_to_v5_adds_created_by(tmp_path: Path) -> None:
    import sqlite3

    db = tmp_path / "v4.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            "to" TEXT NOT NULL,
            target_number TEXT NOT NULL DEFAULT '',
            kind TEXT NOT NULL,
            run_at TEXT,
            cron_expr TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            next_run_at TEXT,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.execute(
        "CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL)"
    )
    conn.execute(
        """
        INSERT INTO jobs (
            id, title, content, "to", target_number, kind, run_at, enabled, source, status
        ) VALUES (
            'j4', 'v4 job', 'hello', 'eu', '5511999998888@c.us', 'once',
            '2026-09-12T17:00:00+00:00', 1, 'sqlite', 'scheduled'
        )
        """
    )
    conn.execute("PRAGMA user_version=4")
    conn.commit()
    conn.close()

    migrated = connect(str(db))
    version = migrated.execute("PRAGMA user_version").fetchone()
    assert version is not None and int(version[0]) == SCHEMA_VERSION
    repo = JobRepository(migrated)
    job = repo.get("j4")
    assert job is not None
    assert job.created_by == ""
    migrated.close()


def test_migration_v5_to_v6_adds_templates_and_template_id(tmp_path: Path) -> None:
    import sqlite3

    db = tmp_path / "v5.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            "to" TEXT NOT NULL,
            target_number TEXT NOT NULL DEFAULT '',
            kind TEXT NOT NULL,
            run_at TEXT,
            cron_expr TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            next_run_at TEXT,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.execute(
        "CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL)"
    )
    conn.execute(
        """
        INSERT INTO jobs (
            id, title, content, "to", target_number, kind, run_at, enabled, source, status
        ) VALUES (
            'j5', 'v5 job', 'hello', 'eu', '5511999998888@c.us', 'once',
            '2026-09-12T17:00:00+00:00', 1, 'sqlite', 'scheduled'
        )
        """
    )
    conn.execute("PRAGMA user_version=5")
    conn.commit()
    conn.close()

    migrated = connect(str(db))
    version = migrated.execute("PRAGMA user_version").fetchone()
    assert version is not None and int(version[0]) == SCHEMA_VERSION
    cols = {str(row[1]) for row in migrated.execute("PRAGMA table_info(jobs)")}
    assert "template_id" in cols
    table = migrated.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='templates'"
    ).fetchone()
    assert table is not None
    repo = JobRepository(migrated)
    job = repo.get("j5")
    assert job is not None
    assert job.template_id is None
    migrated.close()


def test_migration_v6_to_v7_adds_group_id(tmp_path: Path) -> None:
    import sqlite3

    db = tmp_path / "v6.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            "to" TEXT NOT NULL,
            target_number TEXT NOT NULL DEFAULT '',
            kind TEXT NOT NULL,
            run_at TEXT,
            cron_expr TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            next_run_at TEXT,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL DEFAULT '',
            template_id TEXT
        )
        """
    )
    conn.execute(
        "CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL)"
    )
    conn.execute(
        """
        CREATE TABLE templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        INSERT INTO jobs (
            id, title, content, "to", target_number, kind, run_at, enabled, source, status
        ) VALUES (
            'j6', 'v6 job', 'hello', 'eu', '5511999998888@c.us', 'once',
            '2026-09-12T17:00:00+00:00', 1, 'sqlite', 'scheduled'
        )
        """
    )
    conn.execute("PRAGMA user_version=6")
    conn.commit()
    conn.close()

    migrated = connect(str(db))
    version = migrated.execute("PRAGMA user_version").fetchone()
    assert version is not None and int(version[0]) == SCHEMA_VERSION
    cols = {str(row[1]) for row in migrated.execute("PRAGMA table_info(jobs)")}
    assert "group_id" in cols
    repo = JobRepository(migrated)
    job = repo.get("j6")
    assert job is not None
    assert job.group_id is None

    # Test roundtrip with group_id populated
    from schemas.job import Job, JobKind, JobSource, JobStatus

    group_job = Job(
        id="j7",
        title="Group Job",
        content="Hello Group",
        to="amigo",
        target_number="5511888887777@c.us",
        kind=JobKind.ONCE,
        run_at="2026-09-15T12:00:00+00:00",
        enabled=True,
        source=JobSource.SQLITE,
        status=JobStatus.SCHEDULED,
        next_run_at="2026-09-15T12:00:00+00:00",
        group_id="grp-xyz",
    )
    repo.insert(group_job)
    by_group = repo.list_by_group("grp-xyz")
    assert len(by_group) == 1
    assert by_group[0].id == "j7"
    assert by_group[0].group_id == "grp-xyz"
    migrated.close()


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


def test_migration_v7_to_v8_creates_job_runs(tmp_path: Path) -> None:
    import sqlite3

    db = tmp_path / "v7.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            "to" TEXT NOT NULL,
            target_number TEXT NOT NULL DEFAULT '',
            kind TEXT NOT NULL,
            run_at TEXT,
            cron_expr TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            next_run_at TEXT,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL DEFAULT '',
            template_id TEXT,
            group_id TEXT
        )
        """
    )
    conn.execute(
        "CREATE TABLE contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL)"
    )
    conn.execute(
        "CREATE TABLE templates ("
        "id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, body TEXT NOT NULL"
        ")"
    )
    conn.execute("PRAGMA user_version=7")
    conn.commit()
    conn.close()

    migrated = connect(str(db))
    version = migrated.execute("PRAGMA user_version").fetchone()
    assert version is not None and int(version[0]) == SCHEMA_VERSION
    table = migrated.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='job_runs'"
    ).fetchone()
    assert table is not None
    migrated.close()


def test_job_runs_record_list_and_purge(tmp_path: Path) -> None:
    from schemas.job import JobRun, JobRunStatus, JobRunTrigger

    conn = connect(str(tmp_path / "runs.sqlite"))
    repo = JobRepository(conn)

    job = Job(
        id="job-for-runs",
        title="Job with runs",
        content="Testing runs",
        to="eu",
        kind=JobKind.ONCE,
        run_at=datetime(2026, 9, 19, 12, 0, tzinfo=UTC),
    )
    repo.insert(job)

    t1 = datetime(2026, 9, 19, 12, 0, tzinfo=UTC)
    run1 = JobRun(
        id="run-1",
        job_id=job.id,
        ran_at=t1,
        trigger=JobRunTrigger.SCHEDULE,
        status=JobRunStatus.SUCCESS,
        status_code=202,
        duration_ms=45.2,
        error_message=None,
    )
    repo.record_run(run1)

    t2 = datetime(2026, 9, 19, 12, 5, tzinfo=UTC)
    run2 = JobRun(
        id="run-2",
        job_id=job.id,
        ran_at=t2,
        trigger=JobRunTrigger.MANUAL,
        status=JobRunStatus.ERROR,
        status_code=422,
        duration_ms=120.0,
        error_message="invalid phone",
    )
    repo.record_run(run2)

    runs = repo.list_runs_for_job(job.id)
    assert len(runs) == 2
    assert runs[0].id == "run-2"
    assert runs[0].status == JobRunStatus.ERROR
    assert runs[0].duration_ms == 120.0
    assert runs[1].id == "run-1"
    assert runs[1].status == JobRunStatus.SUCCESS

    filtered_runs = repo.list_runs(status_filter="success")
    assert len(filtered_runs) == 1
    assert filtered_runs[0].id == "run-1"

    cutoff = datetime(2026, 9, 19, 12, 2, tzinfo=UTC)
    deleted = repo.purge_old_job_runs(cutoff)
    assert deleted == 1
    remaining = repo.list_runs_for_job(job.id)
    assert len(remaining) == 1
    assert remaining[0].id == "run-2"
    conn.close()


def test_job_runs_cascade_delete_on_job_deletion(tmp_path: Path) -> None:
    from schemas.job import JobRun, JobRunStatus, JobRunTrigger

    conn = connect(str(tmp_path / "cascade.sqlite"))
    repo = JobRepository(conn)

    job = Job(
        id="job-to-delete",
        title="Job to delete",
        content="Bye",
        to="eu",
        kind=JobKind.ONCE,
        run_at=datetime(2026, 9, 19, 10, 0, tzinfo=UTC),
    )
    repo.insert(job)

    run = JobRun(
        id="run-cascade-1",
        job_id=job.id,
        ran_at=datetime(2026, 9, 19, 10, 0, tzinfo=UTC),
        trigger=JobRunTrigger.SCHEDULE,
        status=JobRunStatus.SUCCESS,
        status_code=202,
        duration_ms=50.0,
    )
    repo.record_run(run)
    assert repo.get_run("run-cascade-1") is not None

    conn.execute("DELETE FROM jobs WHERE id = ?", (job.id,))
    conn.commit()

    assert repo.get_run("run-cascade-1") is None
    conn.close()


def test_migration_v8_to_v9_adds_variables(tmp_path: Path) -> None:
    import sqlite3

    db = tmp_path / "v8.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            "to" TEXT NOT NULL,
            target_number TEXT NOT NULL DEFAULT '',
            kind TEXT NOT NULL,
            run_at TEXT,
            cron_expr TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            next_run_at TEXT,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL DEFAULT '',
            template_id TEXT,
            group_id TEXT
        )
        """
    )
    conn.execute("PRAGMA user_version=8")
    conn.execute(
        """
        INSERT INTO jobs (
            id, title, content, "to", target_number, kind, run_at, enabled, source, status
        ) VALUES (
            'j8', 'v8 job', 'hello v8', 'eu', '5511999998888@c.us', 'once',
            '2026-09-12T17:00:00+00:00', 1, 'sqlite', 'scheduled'
        )
        """
    )
    conn.commit()
    conn.close()

    migrated = connect(str(db))
    repo = JobRepository(migrated)
    job = repo.get("j8")
    assert job is not None
    assert job.variables == {}

    # Check user_version is 10 (latest)
    row = migrated.execute("PRAGMA user_version").fetchone()
    assert row[0] == 10
    migrated.close()


def test_migration_v9_to_v10_adds_lifecycle(tmp_path: Path) -> None:
    import sqlite3

    db = tmp_path / "v9.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            "to" TEXT NOT NULL,
            target_number TEXT NOT NULL DEFAULT '',
            kind TEXT NOT NULL,
            run_at TEXT,
            cron_expr TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            next_run_at TEXT,
            last_run_at TEXT,
            last_status TEXT,
            last_error TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL DEFAULT '',
            template_id TEXT,
            group_id TEXT,
            variables TEXT NOT NULL DEFAULT '{}'
        )
        """
    )
    conn.execute("PRAGMA user_version=9")
    conn.execute(
        """
        INSERT INTO jobs (
            id, title, content, "to", target_number, kind, cron_expr, enabled, source, status
        ) VALUES (
            'j9', 'v9 recurring', 'hello v9', 'eu', '5511999998888@c.us', 'cron',
            '0 9 * * *', 1, 'sqlite', 'scheduled'
        )
        """
    )
    conn.commit()
    conn.close()

    migrated = connect(str(db))
    repo = JobRepository(migrated)
    job = repo.get("j9")
    assert job is not None
    assert job.until is None
    assert job.max_runs is None
    assert job.run_count == 0

    # Verify user_version is 10
    row = migrated.execute("PRAGMA user_version").fetchone()
    assert row[0] == 10
    migrated.close()


def test_job_variables_roundtrip(tmp_path: Path) -> None:
    conn = connect(str(tmp_path / "variables.sqlite"))
    repo = JobRepository(conn)

    job = Job(
        id="job-vars-1",
        title="Job with Variables",
        content="Olá {{name}}, seu protocolo é {{protocolo}}.",
        to="eu",
        kind=JobKind.ONCE,
        run_at=datetime(2027, 9, 20, 12, 0, tzinfo=UTC),
        variables={"protocolo": "PROT-12345", "sala": "302"},
    )
    inserted = repo.insert(job)
    assert inserted.variables == {"protocolo": "PROT-12345", "sala": "302"}

    fetched = repo.get("job-vars-1")
    assert fetched is not None
    assert fetched.variables == {"protocolo": "PROT-12345", "sala": "302"}

    # Update variables
    updated = repo.update(fetched.model_copy(update={"variables": {"protocolo": "PROT-99999"}}))
    assert updated.variables == {"protocolo": "PROT-99999"}

    re_fetched = repo.get("job-vars-1")
    assert re_fetched is not None
    assert re_fetched.variables == {"protocolo": "PROT-99999"}
    conn.close()
