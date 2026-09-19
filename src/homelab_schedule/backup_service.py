from __future__ import annotations

import asyncio
import logging
import sqlite3
import tempfile
import uuid
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from homelab_schedule.contacts_repository import ContactRepository
from homelab_schedule.cron import next_cron_utc
from homelab_schedule.repository import JobRepository
from homelab_schedule.store import (
    _dt_to_db,
    _row_to_job_run,
)
from homelab_schedule.templates_repository import TemplateRepository
from schemas.api import JobListFilter
from schemas.backup import (
    ContactImportItem,
    ExportDataResponse,
    ExportMetadata,
    FkViolation,
    ImportDataRequest,
    ImportDataResponse,
    ImportMode,
    ImportSummary,
    IntegrityCheckResponse,
    JobImportItem,
    JobRunImportItem,
    TemplateImportItem,
)
from schemas.job import (
    JobKind,
    JobRun,
    JobSource,
    JobStatus,
)

logger = logging.getLogger(__name__)


class BackupService:
    def __init__(
        self,
        conn: sqlite3.Connection,
        job_repo: JobRepository,
        contacts_repo: ContactRepository,
        templates_repo: TemplateRepository,
        notebook_changed: asyncio.Event,
        clock_now: Callable[[], datetime],
    ) -> None:
        self._conn = conn
        self._job_repo = job_repo
        self._contacts_repo = contacts_repo
        self._templates_repo = templates_repo
        self._notebook_changed = notebook_changed
        self._clock_now = clock_now

    def backup_database_bytes(self) -> bytes:
        """Create a consistent online backup of SQLite database into bytes using backup API."""
        with tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False) as tmp:
            tmp_path = Path(tmp.name)

        try:
            dest_conn = sqlite3.connect(tmp_path)
            try:
                # Online backup safely copies WAL mode DB pages
                self._conn.backup(dest_conn)
                # Verify integrity of the destination backup copy
                cursor = dest_conn.cursor()
                res = cursor.execute("PRAGMA integrity_check").fetchall()
                if not (len(res) == 1 and str(res[0][0]) == "ok"):
                    raise RuntimeError(f"Backup integrity check failed: {res}")
            finally:
                dest_conn.close()

            return tmp_path.read_bytes()
        finally:
            tmp_path.unlink(missing_ok=True)

    def check_integrity(self) -> IntegrityCheckResponse:
        """Runs SQLite PRAGMA integrity_check and PRAGMA foreign_key_check."""
        cursor = self._conn.cursor()
        integrity_rows = cursor.execute("PRAGMA integrity_check").fetchall()
        integrity_details = [str(r[0]) for r in integrity_rows]
        integrity_ok = len(integrity_details) == 1 and integrity_details[0] == "ok"

        fk_rows = cursor.execute("PRAGMA foreign_key_check").fetchall()
        fk_violations: list[FkViolation] = []
        for r in fk_rows:
            fk_violations.append(
                FkViolation(
                    table=str(r[0]),
                    rowid=int(r[1]),
                    parent=str(r[2]),
                    fkid=int(r[3]),
                )
            )

        return IntegrityCheckResponse(
            integrity_ok=integrity_ok,
            details=integrity_details,
            foreign_keys_ok=len(fk_violations) == 0,
            fk_violations=fk_violations,
        )

    def export_data(self, include_runs: bool = True) -> ExportDataResponse:
        """Export all contacts, templates, SQLite jobs and optionally execution history."""
        contacts = self._contacts_repo.list_all()
        templates = self._templates_repo.list_all()
        all_jobs = self._job_repo.list_jobs(JobListFilter.ALL)
        # We only export SQLite jobs because YAML routines are managed by routines.yaml
        sqlite_jobs = [j for j in all_jobs if j.source is JobSource.SQLITE]

        job_runs: list[JobRun] = []
        if include_runs:
            rows = self._conn.execute(
                "SELECT * FROM job_runs ORDER BY ran_at DESC"
            ).fetchall()
            job_runs = [_row_to_job_run(r) for r in rows]

        now = self._clock_now()
        metadata = ExportMetadata(
            version=1,
            schema_version=8,
            exported_at=now,
            counts={
                "contacts": len(contacts),
                "templates": len(templates),
                "jobs": len(sqlite_jobs),
                "job_runs": len(job_runs),
            },
        )

        return ExportDataResponse(
            metadata=metadata,
            contacts=contacts,
            templates=templates,
            jobs=sqlite_jobs,
            job_runs=job_runs,
        )

    def import_data(self, payload: ImportDataRequest) -> ImportDataResponse:
        """
        Atomically import contacts, templates, jobs, and job_runs.
        In REPLACE mode:
          Clears existing job_runs, sqlite jobs, templates, and contacts.
        In MERGE mode:
          Upserts contacts, templates, and jobs.
        """
        summary = ImportSummary()
        warnings: list[str] = []
        now = self._clock_now()
        has_active_jobs_change = False

        # Execute all import steps inside an atomic SQLite transaction
        with self._conn:
            cursor = self._conn.cursor()

            if payload.mode is ImportMode.REPLACE:
                cursor.execute("DELETE FROM job_runs")
                cursor.execute("DELETE FROM jobs WHERE source = 'sqlite'")
                cursor.execute("DELETE FROM templates")
                cursor.execute("DELETE FROM contacts")

            # 1. Contacts
            for c_item in payload.contacts:
                res = self._import_contact(cursor, c_item, payload.mode)
                if res == "created":
                    summary.contacts.created += 1
                elif res == "updated":
                    summary.contacts.updated += 1
                else:
                    summary.contacts.skipped += 1

            # 2. Templates
            for t_item in payload.templates:
                res = self._import_template(cursor, t_item, payload.mode)
                if res == "created":
                    summary.templates.created += 1
                elif res == "updated":
                    summary.templates.updated += 1
                else:
                    summary.templates.skipped += 1

            # 3. Jobs
            for j_item in payload.jobs:
                if j_item.source is JobSource.YAML:
                    warnings.append(
                        f"Job {j_item.id or j_item.title}: ignorado pois é rotina YAML"
                    )
                    summary.jobs.skipped += 1
                    continue

                res, was_active = self._import_job(cursor, j_item, payload.mode, now)
                if was_active:
                    has_active_jobs_change = True
                if res == "created":
                    summary.jobs.created += 1
                elif res == "updated":
                    summary.jobs.updated += 1
                else:
                    summary.jobs.skipped += 1

            # 4. Job Runs
            # Cache valid job IDs to prevent foreign key errors on orphan runs
            existing_job_ids = {
                str(r[0]) for r in cursor.execute("SELECT id FROM jobs").fetchall()
            }
            for run_item in payload.job_runs:
                if run_item.job_id not in existing_job_ids:
                    warnings.append(
                        f"JobRun {run_item.id}: ignorado pois job_id '{run_item.job_id}' não existe"
                    )
                    summary.job_runs.skipped += 1
                    continue

                res = self._import_job_run(cursor, run_item, payload.mode)
                if res == "created":
                    summary.job_runs.created += 1
                elif res == "updated":
                    summary.job_runs.updated += 1
                else:
                    summary.job_runs.skipped += 1

            # Verify integrity at the end of import transaction
            fk_violations = cursor.execute("PRAGMA foreign_key_check").fetchall()
            if fk_violations:
                raise ValueError(
                    f"Import violou chaves estrangeiras: {fk_violations}"
                )

        if has_active_jobs_change:
            self._notebook_changed.set()

        return ImportDataResponse(
            status="imported",
            mode=payload.mode,
            summary=summary,
            warnings=warnings,
        )

    def _import_contact(
        self,
        cursor: sqlite3.Cursor,
        item: ContactImportItem,
        mode: ImportMode,
    ) -> str:
        cid = item.id.strip() if item.id and item.id.strip() else str(uuid.uuid4())
        name = item.name.strip()
        phone = item.phone.strip()

        if mode is ImportMode.REPLACE:
            cursor.execute(
                "INSERT INTO contacts (id, name, phone) VALUES (?, ?, ?)",
                (cid, name, phone),
            )
            return "created"

        # MERGE mode
        # Check if exists by phone
        row = cursor.execute(
            "SELECT id, name, phone FROM contacts WHERE phone = ?",
            (phone,),
        ).fetchone()
        if row is not None:
            existing_id = str(row[0])
            existing_name = str(row[1])
            if existing_name != name:
                cursor.execute(
                    "UPDATE contacts SET name = ? WHERE id = ?",
                    (name, existing_id),
                )
                return "updated"
            return "skipped"

        # Check if exists by name (NOCASE)
        row_name = cursor.execute(
            "SELECT id, name, phone FROM contacts WHERE name = ? COLLATE NOCASE",
            (name,),
        ).fetchone()
        if row_name is not None:
            existing_id = str(row_name[0])
            existing_phone = str(row_name[2])
            if existing_phone != phone:
                cursor.execute(
                    "UPDATE contacts SET phone = ? WHERE id = ?",
                    (phone, existing_id),
                )
                return "updated"
            return "skipped"

        # Check if exists by ID
        row_id = cursor.execute(
            "SELECT id, name, phone FROM contacts WHERE id = ?",
            (cid,),
        ).fetchone()
        if row_id is not None:
            cursor.execute(
                "UPDATE contacts SET name = ?, phone = ? WHERE id = ?",
                (name, phone, cid),
            )
            return "updated"

        # Insert new
        cursor.execute(
            "INSERT INTO contacts (id, name, phone) VALUES (?, ?, ?)",
            (cid, name, phone),
        )
        return "created"

    def _import_template(
        self,
        cursor: sqlite3.Cursor,
        item: TemplateImportItem,
        mode: ImportMode,
    ) -> str:
        tid = item.id.strip() if item.id and item.id.strip() else str(uuid.uuid4())
        name = item.name.strip()
        body = item.body

        if mode is ImportMode.REPLACE:
            cursor.execute(
                "INSERT INTO templates (id, name, body) VALUES (?, ?, ?)",
                (tid, name, body),
            )
            return "created"

        # MERGE mode
        row_name = cursor.execute(
            "SELECT id, name, body FROM templates WHERE name = ? COLLATE NOCASE",
            (name,),
        ).fetchone()
        if row_name is not None:
            existing_id = str(row_name[0])
            existing_body = str(row_name[2])
            if existing_body != body:
                cursor.execute(
                    "UPDATE templates SET body = ? WHERE id = ?",
                    (body, existing_id),
                )
                return "updated"
            return "skipped"

        row_id = cursor.execute(
            "SELECT id, name, body FROM templates WHERE id = ?",
            (tid,),
        ).fetchone()
        if row_id is not None:
            cursor.execute(
                "UPDATE templates SET name = ?, body = ? WHERE id = ?",
                (name, body, tid),
            )
            return "updated"

        cursor.execute(
            "INSERT INTO templates (id, name, body) VALUES (?, ?, ?)",
            (tid, name, body),
        )
        return "created"

    def _import_job(
        self,
        cursor: sqlite3.Cursor,
        item: JobImportItem,
        mode: ImportMode,
        now: datetime,
    ) -> tuple[str, bool]:
        jid = item.id.strip() if item.id and item.id.strip() else str(uuid.uuid4())
        next_run = item.next_run_at
        if next_run is None and item.enabled and item.status is JobStatus.SCHEDULED:
            if item.kind is JobKind.ONCE and item.run_at is not None:
                next_run = item.run_at
            elif item.kind is JobKind.CRON and item.cron_expr is not None:
                next_run = next_cron_utc(item.cron_expr, now)

        is_active = item.enabled and item.status is JobStatus.SCHEDULED

        params = (
            jid,
            item.title,
            item.content,
            item.to,
            item.target_number,
            item.kind.value,
            _dt_to_db(item.run_at),
            item.cron_expr,
            int(item.enabled),
            JobSource.SQLITE.value,
            item.status.value,
            _dt_to_db(next_run),
            _dt_to_db(item.last_run_at),
            item.last_status,
            item.last_error,
            item.retry_count,
            item.created_by,
            item.template_id,
            item.group_id,
        )

        if mode is ImportMode.REPLACE:
            cursor.execute(
                """
                INSERT INTO jobs (
                    id, title, content, "to", target_number, kind, run_at, cron_expr,
                    enabled, source, status, next_run_at, last_run_at,
                    last_status, last_error, retry_count, created_by, template_id, group_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                params,
            )
            return "created", is_active

        # MERGE mode
        existing = cursor.execute("SELECT id, source FROM jobs WHERE id = ?", (jid,)).fetchone()
        if existing is not None:
            if str(existing[1]) == JobSource.YAML.value:
                # Do not overwrite YAML jobs
                return "skipped", False

            cursor.execute(
                """
                UPDATE jobs SET
                    title = ?, content = ?, "to" = ?, target_number = ?, kind = ?,
                    run_at = ?, cron_expr = ?, enabled = ?, source = ?, status = ?,
                    next_run_at = ?, last_run_at = ?, last_status = ?, last_error = ?,
                    retry_count = ?, created_by = ?, template_id = ?, group_id = ?
                WHERE id = ?
                """,
                params[1:] + (jid,),
            )
            return "updated", is_active

        cursor.execute(
            """
            INSERT INTO jobs (
                id, title, content, "to", target_number, kind, run_at, cron_expr,
                enabled, source, status, next_run_at, last_run_at,
                last_status, last_error, retry_count, created_by, template_id, group_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            params,
        )
        return "created", is_active

    def _import_job_run(
        self,
        cursor: sqlite3.Cursor,
        item: JobRunImportItem,
        mode: ImportMode,
    ) -> str:
        rid = item.id.strip() if item.id and item.id.strip() else str(uuid.uuid4())
        params = (
            rid,
            item.job_id,
            _dt_to_db(item.ran_at),
            item.trigger.value,
            item.status.value,
            item.status_code,
            item.duration_ms,
            item.error_message,
        )

        if mode is ImportMode.REPLACE:
            cursor.execute(
                """
                INSERT INTO job_runs (
                    id, job_id, ran_at, trigger, status, status_code, duration_ms, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                params,
            )
            return "created"

        # MERGE mode
        existing = cursor.execute("SELECT id FROM job_runs WHERE id = ?", (rid,)).fetchone()
        if existing is not None:
            return "skipped"

        cursor.execute(
            """
            INSERT INTO job_runs (
                id, job_id, ran_at, trigger, status, status_code, duration_ms, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            params,
        )
        return "created"
