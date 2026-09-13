from __future__ import annotations

import sqlite3
from datetime import UTC, datetime

from homelab_schedule.cron import next_cron_utc
from homelab_schedule.store import _dt_from_db, _dt_to_db, _row_to_job
from schemas.api import JobListFilter
from schemas.job import Job, JobKind, JobSource, JobStatus


class JobRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def insert(self, job: Job) -> Job:
        to_store = _with_next_run(job)
        self._conn.execute(
            """
            INSERT INTO jobs (
                id, title, content, "to", target_number, kind, run_at, cron_expr,
                enabled, source, status, next_run_at, last_run_at,
                last_status, last_error, retry_count, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            _job_params(to_store),
        )
        self._conn.commit()
        stored = self.get(to_store.id)
        if stored is None:
            raise RuntimeError("insert did not persist job")
        return stored

    def get(self, job_id: str) -> Job | None:
        row = self._conn.execute(
            "SELECT * FROM jobs WHERE id = ?",
            (job_id,),
        ).fetchone()
        if row is None:
            return None
        return _row_to_job(row)

    def list_jobs(
        self,
        status_filter: JobListFilter,
        range_from: datetime | None,
        range_to: datetime | None,
        limit: int | None = None,
        phone: str | None = None,
    ) -> list[Job]:
        clauses: list[str] = []
        params: list[str | int] = []
        _apply_status_filter(clauses, params, status_filter)
        if range_from is not None:
            encoded = _dt_to_db(range_from)
            if encoded is not None:
                clauses.append("next_run_at >= ?")
                params.append(encoded)
        if range_to is not None:
            encoded = _dt_to_db(range_to)
            if encoded is not None:
                clauses.append("next_run_at <= ?")
                params.append(encoded)
        if phone:
            clauses.append("(target_number = ? OR created_by = ?)")
            params.append(phone)
            params.append(phone)
        sql = "SELECT * FROM jobs"
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY next_run_at IS NULL, next_run_at ASC"
        if limit is not None and limit > 0:
            sql += " LIMIT ?"
            params.append(limit)
        rows = self._conn.execute(sql, tuple(params)).fetchall()
        return [_row_to_job(row) for row in rows]

    def update(self, job: Job) -> Job:
        self._conn.execute(
            """
            UPDATE jobs SET
                title = ?, content = ?, "to" = ?, target_number = ?, kind = ?, run_at = ?,
                cron_expr = ?, enabled = ?, source = ?, status = ?,
                next_run_at = ?, last_run_at = ?, last_status = ?, last_error = ?, retry_count = ?,
                created_by = ?
            WHERE id = ?
            """,
            (
                *_job_params(job)[1:],
                job.id,
            ),
        )
        self._conn.commit()
        stored = self.get(job.id)
        if stored is None:
            raise RuntimeError("update did not persist job")
        return stored

    def list_due(self, now: datetime) -> list[Job]:
        encoded = _dt_to_db(now)
        rows = self._conn.execute(
            """
            SELECT * FROM jobs
            WHERE enabled = 1 AND status = ? AND next_run_at IS NOT NULL
              AND next_run_at <= ?
            ORDER BY next_run_at ASC
            """,
            (JobStatus.SCHEDULED.value, encoded),
        ).fetchall()
        return [_row_to_job(row) for row in rows]

    def earliest_next_run(self) -> datetime | None:
        row = self._conn.execute(
            """
            SELECT MIN(next_run_at) AS nxt FROM jobs
            WHERE enabled = 1 AND status = ? AND next_run_at IS NOT NULL
            """,
            (JobStatus.SCHEDULED.value,),
        ).fetchone()
        if row is None or row["nxt"] is None:
            return None
        return _dt_from_db(row["nxt"])

    def list_by_source(self, source: JobSource) -> list[Job]:
        rows = self._conn.execute(
            "SELECT * FROM jobs WHERE source = ?",
            (source.value,),
        ).fetchall()
        return [_row_to_job(row) for row in rows]

    def purge_old_jobs(self, before: datetime) -> int:
        encoded = _dt_to_db(before)
        cursor = self._conn.execute(
            """
            DELETE FROM jobs
            WHERE source = ?
              AND status IN (?, ?)
              AND (
                (last_run_at IS NOT NULL AND last_run_at < ?)
                OR (last_run_at IS NULL AND run_at IS NOT NULL AND run_at < ?)
              )
            """,
            (
                JobSource.SQLITE.value,
                JobStatus.DONE.value,
                JobStatus.ERROR.value,
                encoded,
                encoded,
            ),
        )
        self._conn.commit()
        return cursor.rowcount


    def count_scheduled_for_phone(self, phone: str) -> int:
        row = self._conn.execute(
            """
            SELECT COUNT(*) AS n FROM jobs
            WHERE target_number = ? AND status = ?
            """,
            (phone, JobStatus.SCHEDULED.value),
        ).fetchone()
        if row is None:
            return 0
        return int(row["n"])


def _apply_status_filter(
    clauses: list[str],
    params: list[str | int],
    status_filter: JobListFilter,
) -> None:
    if status_filter is JobListFilter.ALL:
        return
    if status_filter is JobListFilter.UPCOMING:
        clauses.append("status = ?")
        params.append(JobStatus.SCHEDULED.value)
        return
    if status_filter is JobListFilter.DONE:
        clauses.append("status = ?")
        params.append(JobStatus.DONE.value)
        return
    if status_filter is JobListFilter.ERROR:
        clauses.append("status = ?")
        params.append(JobStatus.ERROR.value)
        return
    clauses.append("status = ?")
    params.append(JobStatus.PAUSED.value)


def _with_next_run(job: Job, now: datetime | None = None) -> Job:
    if job.next_run_at is not None:
        return job
    if job.kind is JobKind.ONCE and job.run_at is not None:
        return job.model_copy(update={"next_run_at": job.run_at})
    if job.kind is JobKind.CRON and job.cron_expr is not None:
        instant = now if now is not None else datetime.now(UTC)
        return job.model_copy(update={"next_run_at": next_cron_utc(job.cron_expr, instant)})
    return job


def _job_params(job: Job) -> tuple[
    str,
    str,
    str,
    str,
    str,
    str,
    str | None,
    str | None,
    int,
    str,
    str,
    str | None,
    str | None,
    str | None,
    str | None,
    int,
    str,
]:
    return (
        job.id,
        job.title,
        job.content,
        job.to,
        job.target_number,
        job.kind.value,
        _dt_to_db(job.run_at),
        job.cron_expr,
        int(job.enabled),
        job.source.value,
        job.status.value,
        _dt_to_db(job.next_run_at),
        _dt_to_db(job.last_run_at),
        job.last_status,
        job.last_error,
        job.retry_count,
        job.created_by,
    )
