from __future__ import annotations

import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from schemas.job import Job, JobKind, JobSource, JobStatus

SCHEMA_VERSION = 5
APP_TZ = ZoneInfo("America/Sao_Paulo")

_CREATE_JOBS = """
CREATE TABLE IF NOT EXISTS jobs (
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

_CREATE_CONTACTS = """
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL
)
"""


def connect(database_path: str) -> sqlite3.Connection:
    path = Path(database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    init_schema(conn)
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute(_CREATE_JOBS)
    conn.execute(_CREATE_CONTACTS)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs (status, enabled, next_run_at)"
    )
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (phone)")
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_name ON contacts (name COLLATE NOCASE)"
    )
    row = conn.execute("PRAGMA user_version").fetchone()
    version = int(row[0]) if row is not None else 0
    if version < 2:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(jobs)").fetchall()]
        if "target_number" not in cols:
            conn.execute("ALTER TABLE jobs ADD COLUMN target_number TEXT NOT NULL DEFAULT ''")
            conn.execute('UPDATE jobs SET target_number = "to" WHERE target_number = \'\'')
        conn.execute("PRAGMA user_version=2")
    if version < 3:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(jobs)").fetchall()]
        if "retry_count" not in cols:
            conn.execute("ALTER TABLE jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0")
        conn.execute("PRAGMA user_version=3")
    if version < 4:
        conn.execute("PRAGMA user_version=4")
    if version < 5:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(jobs)").fetchall()]
        if "created_by" not in cols:
            conn.execute("ALTER TABLE jobs ADD COLUMN created_by TEXT NOT NULL DEFAULT ''")
        conn.execute("PRAGMA user_version=5")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_jobs_phone ON jobs (target_number, created_by)"
    )
    conn.commit()


def _dt_to_db(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=APP_TZ)
    return value.astimezone(UTC).isoformat()


def _dt_from_db(value: object) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise TypeError("timestamp column must be TEXT or NULL")
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _row_to_job(row: sqlite3.Row) -> Job:
    return Job(
        id=str(row["id"]),
        title=str(row["title"]),
        content=str(row["content"]),
        to=str(row["to"]),
        target_number=str(row["target_number"])
        if "target_number" in row.keys() and row["target_number"] is not None
        else str(row["to"]),
        kind=JobKind(str(row["kind"])),
        run_at=_dt_from_db(row["run_at"]),
        cron_expr=str(row["cron_expr"]) if row["cron_expr"] is not None else None,
        enabled=bool(row["enabled"]),
        source=JobSource(str(row["source"])),
        status=JobStatus(str(row["status"])),
        next_run_at=_dt_from_db(row["next_run_at"]),
        last_run_at=_dt_from_db(row["last_run_at"]),
        last_status=str(row["last_status"]) if row["last_status"] is not None else None,
        last_error=str(row["last_error"]) if row["last_error"] is not None else None,
        retry_count=int(row["retry_count"])
        if "retry_count" in row.keys() and row["retry_count"] is not None
        else 0,
        created_by=str(row["created_by"])
        if "created_by" in row.keys() and row["created_by"] is not None
        else "",
    )
