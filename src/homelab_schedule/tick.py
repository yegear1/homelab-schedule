from __future__ import annotations

import asyncio
from collections.abc import Callable
from datetime import datetime

from homelab_schedule.aliases import resolve_destination
from homelab_schedule.cron import next_cron_utc
from homelab_schedule.dispatch import Dispatcher
from homelab_schedule.repository import JobRepository
from schemas.job import Job, JobKind, JobStatus

_FAILURE_BACKOFF = 5.0
_MIN_SLEEP = 0.05


async def run_tick(
    *,
    stop: asyncio.Event,
    wake: asyncio.Event,
    repo: JobRepository,
    dispatcher: Dispatcher,
    aliases: dict[str, str],
    now: Callable[[], datetime],
    cap_seconds: float = 300.0,
) -> None:
    while not stop.is_set():
        failed = await fire_due(repo, dispatcher, aliases, now())
        delay = _next_delay(repo, now(), cap_seconds, failed)
        try:
            await asyncio.wait_for(wake.wait(), timeout=delay)
        except TimeoutError:
            pass
        wake.clear()


async def fire_due(
    repo: JobRepository,
    dispatcher: Dispatcher,
    aliases: dict[str, str],
    now: datetime,
) -> bool:
    failed = False
    for job in repo.list_due(now):
        dest = job.target_number or resolve_destination(job.to, aliases)
        result = await dispatcher.send(phone_number=dest, content=job.content)
        if result.ok:
            repo.update(_after_success(job, now))
            continue
        failed = True
        repo.update(_after_failure(job, result.last_error, result.permanent))
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
        }
    )


def _after_failure(job: Job, last_error: str | None, permanent: bool) -> Job:
    status = JobStatus.ERROR if permanent else job.status
    enabled = False if permanent else job.enabled
    return job.model_copy(
        update={"status": status, "enabled": enabled, "last_error": last_error}
    )
