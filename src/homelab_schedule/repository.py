from __future__ import annotations

import sqlite3
from datetime import datetime

from homelab_schedule.store import _dt_to_db, _row_to_job
from schemas.api import JobListFilter
from schemas.job import Job, JobKind, JobStatus


class JobRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def insert(self, job: Job) -> Job:
        to_store = _with_next_run(job)
        self._conn.execute(
            """
            INSERT INTO jobs (
                id, title, content, "to", kind, run_at, cron_expr,
                enabled, source, status, next_run_at, last_run_at,
                last_status, last_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ) -> list[Job]:
        clauses: list[str] = []
        params: list[str] = []
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
        sql = "SELECT * FROM jobs"
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY next_run_at IS NULL, next_run_at ASC"
        rows = self._conn.execute(sql, params).fetchall()
        return [_row_to_job(row) for row in rows]

    def update(self, job: Job) -> Job:
        self._conn.execute(
            """
            UPDATE jobs SET
                title = ?, content = ?, "to" = ?, kind = ?, run_at = ?,
                cron_expr = ?, enabled = ?, source = ?, status = ?,
                next_run_at = ?, last_run_at = ?, last_status = ?, last_error = ?
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


def _apply_status_filter(
    clauses: list[str],
    params: list[str],
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
    clauses.append("status = ?")
    params.append(JobStatus.PAUSED.value)


def _with_next_run(job: Job) -> Job:
    if job.next_run_at is not None or job.kind is not JobKind.ONCE or job.run_at is None:
        return job
    return job.model_copy(update={"next_run_at": job.run_at})


def _job_params(job: Job) -> tuple[
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
]:
    return (
        job.id,
        job.title,
        job.content,
        job.to,
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
    )
