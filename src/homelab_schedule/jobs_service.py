from __future__ import annotations

import asyncio
import uuid
from collections.abc import Callable
from datetime import datetime

from homelab_schedule.aliases import normalize_whatsapp_phone, resolve_destination
from homelab_schedule.dispatch import Dispatcher
from homelab_schedule.errors import EntityNotFound, GatekeeperError, YamlJobImmutable
from homelab_schedule.repository import JobRepository
from schemas.api import CreateJobRequest, JobListFilter, JobListItem, RunNowResponse
from schemas.job import Job, JobKind, JobSource, JobStatus


class JobService:
    def __init__(
        self,
        repo: JobRepository,
        notebook_changed: asyncio.Event,
        dispatcher: Dispatcher,
        aliases: dict[str, str],
        now: Callable[[], datetime],
    ) -> None:
        self._repo = repo
        self._notebook_changed = notebook_changed
        self._dispatcher = dispatcher
        self._aliases = aliases
        self._now = now

    def create(self, payload: CreateJobRequest) -> Job:
        target = (
            normalize_whatsapp_phone(payload.target_number)
            if payload.target_number
            else resolve_destination(payload.to, self._aliases)
        )
        job = Job(
            id=str(uuid.uuid4()),
            title=payload.title,
            content=payload.content,
            to=payload.to,
            target_number=target,
            kind=payload.kind,
            run_at=payload.run_at,
            cron_expr=payload.cron_expr,
            source=JobSource.SQLITE,
            status=JobStatus.SCHEDULED,
        )
        stored = self._repo.insert(job)
        self._notebook_changed.set()
        return stored

    def get(self, job_id: str) -> Job:
        job = self._repo.get(job_id)
        if job is None:
            raise EntityNotFound("job not found")
        return job

    def list_jobs(
        self,
        status_filter: JobListFilter,
        range_from: datetime | None,
        range_to: datetime | None,
    ) -> list[JobListItem]:
        jobs = self._repo.list_jobs(status_filter, range_from, range_to)
        return [JobListItem.model_validate(job.model_dump()) for job in jobs]

    def cancel(self, job_id: str) -> None:
        job = self.get(job_id)
        if job.source is JobSource.YAML:
            raise YamlJobImmutable("edit routines.yaml to change this job")
        self._repo.update(_cancelled(job))
        self._notebook_changed.set()

    async def run_now(self, job_id: str) -> RunNowResponse:
        job = self.get(job_id)
        dest = job.target_number or resolve_destination(job.to, self._aliases)
        result = await self._dispatcher.send(phone_number=dest, content=job.content)
        self._notebook_changed.set()
        if not result.ok:
            self._repo.update(job.model_copy(update={"last_error": result.last_error}))
            raise GatekeeperError("gatekeeper did not accept the message")
        self._repo.update(
            job.model_copy(
                update={
                    "last_run_at": self._now(),
                    "last_status": "queued",
                    "last_error": None,
                }
            )
        )
        return RunNowResponse(status="queued", job_id=job.id)


def _cancelled(job: Job) -> Job:
    if job.kind is JobKind.CRON:
        return job.model_copy(update={"enabled": False, "status": JobStatus.PAUSED})
    return job.model_copy(
        update={"enabled": False, "status": JobStatus.DONE, "next_run_at": None}
    )
