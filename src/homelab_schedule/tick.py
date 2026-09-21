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
    admin_recipient: str | None = None,
    admin_resolver: Callable[[str], str] | None = None,
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
            admin_recipient=admin_recipient,
            admin_resolver=admin_resolver,
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
    admin_recipient: str | None = None,
    admin_resolver: Callable[[str], str] | None = None,
) -> bool:
    failed = False
    clean_admin = admin_recipient.strip() if admin_recipient else ""
    for job in repo.list_due(now):
        is_expired = job.until is not None and (
            now > job.until or (job.next_run_at and job.next_run_at > job.until)
        )
        if is_expired:
            repo.update(
                job.model_copy(
                    update={"status": JobStatus.DONE, "enabled": False, "next_run_at": None}
                )
            )
            continue
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
        is_dead_letter = result.permanent or job.retry_count >= _MAX_RETRIES
        repo.update(_after_failure(job, result.last_error, result.permanent, now))
        if is_dead_letter and clean_admin:
            admin_dest = (
                admin_resolver(clean_admin)
                if admin_resolver is not None
                else resolve_destination(clean_admin, aliases)
            )
            if admin_dest:
                await _send_dead_letter_alert(
                    dispatcher=dispatcher,
                    admin_dest=admin_dest,
                    job=job,
                    error_message=result.last_error,
                    status_code=result.status_code,
                    retry_count=job.retry_count,
                    permanent=result.permanent,
                )
    return failed


async def _send_dead_letter_alert(
    *,
    dispatcher: Dispatcher,
    admin_dest: str,
    job: Job,
    error_message: str | None,
    status_code: int,
    retry_count: int,
    permanent: bool,
) -> None:
    job_kind_str = "pontual" if job.kind is JobKind.ONCE else "recorrente"
    action_str = (
        "Job desativado no SQLite (Dead-Letter)."
        if job.kind is JobKind.ONCE
        else "Ocorrência descartada; próximo ciclo agendado."
    )
    attempts_str = "1 (erro permanente)" if permanent else f"{retry_count + 1}"
    alert_content = (
        "🚨 *[Alerta Dead-Letter]* Falha definitiva no disparo da agenda.\n"
        f"• *Job:* {job.title} (`{job.id}`)\n"
        f"• *Destino original:* {job.to}\n"
        f"• *Tipo:* {job_kind_str}\n"
        f"• *Erro:* {error_message or 'desconhecido'} (HTTP {status_code})\n"
        f"• *Tentativas:* {attempts_str}\n"
        f"• *Ação:* {action_str}"
    )
    try:
        alert_res = await dispatcher.send(phone_number=admin_dest, content=alert_content)
        if alert_res.ok:
            _LOG.info(
                "dead_letter_alert_sent",
                extra={"event": "dead_letter_alert_sent", "job_id": job.id},
            )
        else:
            _LOG.error(
                "dead_letter_alert_failed",
                extra={
                    "event": "dead_letter_alert_failed",
                    "job_id": job.id,
                    "status_code": alert_res.status_code,
                },
            )
    except Exception as exc:
        _LOG.error(
            "dead_letter_alert_exception",
            extra={
                "event": "dead_letter_alert_exception",
                "job_id": job.id,
                "error": str(exc),
            },
        )


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
    new_run_count = job.run_count + 1
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
                "run_count": new_run_count,
            }
        )
    if job.cron_expr is None:
        raise RuntimeError("cron job missing cron_expr")

    if job.max_runs is not None and new_run_count >= job.max_runs:
        return job.model_copy(
            update={
                "status": JobStatus.DONE,
                "enabled": False,
                "next_run_at": None,
                "last_run_at": now,
                "last_status": "queued",
                "last_error": None,
                "retry_count": 0,
                "run_count": new_run_count,
            }
        )

    nxt = next_cron_utc(job.cron_expr, now)
    if job.until is not None and nxt > job.until:
        return job.model_copy(
            update={
                "status": JobStatus.DONE,
                "enabled": False,
                "next_run_at": None,
                "last_run_at": now,
                "last_status": "queued",
                "last_error": None,
                "retry_count": 0,
                "run_count": new_run_count,
            }
        )

    return job.model_copy(
        update={
            "next_run_at": nxt,
            "last_run_at": now,
            "last_status": "queued",
            "last_error": None,
            "retry_count": 0,
            "run_count": new_run_count,
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
        nxt = next_cron_utc(job.cron_expr, now)
        if job.until is not None and nxt > job.until:
            return job.model_copy(
                update={
                    "status": JobStatus.DONE,
                    "enabled": False,
                    "next_run_at": None,
                    "last_error": last_error,
                    "retry_count": 0,
                }
            )
        return job.model_copy(
            update={
                "last_error": last_error,
                "next_run_at": nxt,
                "retry_count": 0,
            }
        )

    new_retry = job.retry_count + 1
    delay_minutes = _BASE_RETRY_MINUTES**new_retry
    next_run = now + timedelta(minutes=delay_minutes)
    if job.until is not None and next_run > job.until:
        return job.model_copy(
            update={
                "status": JobStatus.DONE,
                "enabled": False,
                "last_error": last_error,
                "next_run_at": None,
                "retry_count": new_retry,
            }
        )
    return job.model_copy(
        update={
            "retry_count": new_retry,
            "next_run_at": next_run,
            "status": JobStatus.SCHEDULED,
            "enabled": True,
            "last_error": last_error,
        }
    )
