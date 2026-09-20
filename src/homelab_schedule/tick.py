from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from pathlib import Path

from homelab_schedule.aliases import resolve_destination
from homelab_schedule.cron import next_cron_utc
from homelab_schedule.dispatch import Dispatcher
from homelab_schedule.repository import JobRepository
from homelab_schedule.routines import merge_routines
from homelab_schedule.templates import render_outbound_message
from schemas.job import Job, JobKind, JobRun, JobRunStatus, JobRunTrigger, JobStatus

_LOG = logging.getLogger("homelab_schedule.tick")
_FAILURE_BACKOFF = 5.0
_MIN_SLEEP = 0.05
_DAY_SECONDS = 86400.0
_MAX_RETRIES = 3
_BASE_RETRY_MINUTES = 2


async def run_tick(
    *,
    stop: asyncio.Event,
    wake: asyncio.Event,
    repo: JobRepository,
    dispatcher: Dispatcher,
    aliases: dict[str, str],
    now: Callable[[], datetime],
    cap_seconds: float = 300.0,
    routines_path: Path | None = None,
    retention_days: int = 365,
    dest_name: Callable[[str], str | None] | None = None,
    template_body: Callable[[str], str | None] | None = None,
) -> None:
    last_routines_mtime: float | None = _get_mtime(routines_path)
    last_housekeeping: datetime | None = None
    while not stop.is_set():
        current_now = now()
        if routines_path is not None:
            current_mtime = _get_mtime(routines_path)
            if current_mtime != last_routines_mtime:
                last_routines_mtime = current_mtime
                try:
                    merge_routines(repo, routines_path, current_now)
                except Exception:
                    pass
        if retention_days > 0:
            if (
                last_housekeeping is None
                or (current_now - last_housekeeping).total_seconds() >= _DAY_SECONDS
            ):
                last_housekeeping = current_now
                cutoff = current_now - timedelta(days=retention_days)
                deleted = repo.purge_old_jobs(cutoff)
                deleted_runs = repo.purge_old_job_runs(cutoff)
                if deleted > 0 or deleted_runs > 0:
                    _LOG.info(
                        "housekeeping_purged",
                        extra={
                            "deleted_count": deleted,
                            "deleted_runs_count": deleted_runs,
                            "retention_days": retention_days,
                        },
                    )
        failed = await fire_due(
            repo,
            dispatcher,
            aliases,
            current_now,
            dest_name=dest_name,
            template_body=template_body,
        )
        delay = _next_delay(repo, current_now, cap_seconds, failed)
        try:
            await asyncio.wait_for(wake.wait(), timeout=delay)
        except TimeoutError:
            pass
        wake.clear()


def _get_mtime(path: Path | None) -> float | None:
    if path is None or not path.is_file():
        return None
    try:
        return path.stat().st_mtime
    except OSError:
        return None


async def fire_due(
    repo: JobRepository,
    dispatcher: Dispatcher,
    aliases: dict[str, str],
    now: datetime,
    dest_name: Callable[[str], str | None] | None = None,
    template_body: Callable[[str], str | None] | None = None,
) -> bool:
    failed = False
    for job in repo.list_due(now):
        dest = job.target_number or resolve_destination(job.to, aliases)
        catalog: str | None = None
        if job.template_id and template_body is not None:
            catalog = template_body(job.template_id)
        name = dest_name(dest) if dest_name is not None else None
        content_to_send = render_outbound_message(
            stored_content=job.content,
            when=now,
            dest_name=name,
            catalog_body=catalog,
            custom_variables=job.variables,
        )
        result = await dispatcher.send(phone_number=dest, content=content_to_send)
        run_record = JobRun(
            id=str(uuid.uuid4()),
            job_id=job.id,
            ran_at=now,
            trigger=JobRunTrigger.SCHEDULE,
            status=JobRunStatus.SUCCESS if result.ok else JobRunStatus.ERROR,
            status_code=result.status_code,
            duration_ms=result.duration_ms,
            error_message=result.last_error,
        )
        repo.record_run(run_record)
        if result.ok:
            repo.update(_after_success(job, now))
            continue
        failed = True
        repo.update(_after_failure(job, result.last_error, result.permanent, now))
    return failed


def _next_delay(
    repo: JobRepository,
    now: datetime,
    cap_seconds: float,
    failed: bool,
) -> float:
    if failed:
        return max(_FAILURE_BACKOFF, _MIN_SLEEP)
    nxt = repo.earliest_next_run()
    if nxt is None:
        return cap_seconds
    seconds = (nxt - now).total_seconds()
    return max(min(seconds, cap_seconds), _MIN_SLEEP)


def _after_success(job: Job, now: datetime) -> Job:
    if job.kind is JobKind.ONCE:
        return job.model_copy(
            update={
                "status": JobStatus.DONE,
                "enabled": False,
                "next_run_at": None,
                "last_run_at": now,
                "last_status": "queued",
                "last_error": None,
                "retry_count": 0,
            }
        )
    if job.cron_expr is None:
        raise RuntimeError("cron job missing cron_expr")
    return job.model_copy(
        update={
            "next_run_at": next_cron_utc(job.cron_expr, now),
            "last_run_at": now,
            "last_status": "queued",
            "last_error": None,
            "retry_count": 0,
        }
    )


def _after_failure(job: Job, last_error: str | None, permanent: bool, now: datetime) -> Job:
    if permanent or job.retry_count >= _MAX_RETRIES:
        if job.kind is JobKind.ONCE:
            return job.model_copy(
                update={
                    "status": JobStatus.ERROR,
                    "enabled": False,
                    "last_error": last_error,
                    "next_run_at": None,
                }
            )
        if job.cron_expr is None:
            raise RuntimeError("cron job missing cron_expr")
        return job.model_copy(
            update={
                "last_error": last_error,
                "next_run_at": next_cron_utc(job.cron_expr, now),
                "retry_count": 0,
            }
        )

    new_retry = job.retry_count + 1
    delay_minutes = _BASE_RETRY_MINUTES**new_retry
    next_run = now + timedelta(minutes=delay_minutes)
    return job.model_copy(
        update={
            "retry_count": new_retry,
            "next_run_at": next_run,
            "status": JobStatus.SCHEDULED,
            "enabled": True,
            "last_error": last_error,
        }
    )
