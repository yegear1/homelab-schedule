from __future__ import annotations

import asyncio
import uuid
from collections.abc import Callable
from datetime import datetime

from homelab_schedule.aliases import normalize_whatsapp_phone, resolve_destination
from homelab_schedule.contacts_service import ContactService
from homelab_schedule.cron import next_cron_utc
from homelab_schedule.dispatch import Dispatcher
from homelab_schedule.errors import EntityNotFound, GatekeeperError, YamlJobImmutable
from homelab_schedule.repository import JobRepository
from homelab_schedule.templates import render_outbound_message
from homelab_schedule.templates_repository import TemplateRepository
from schemas.api import (
    CreateJobRequest,
    JobListFilter,
    JobListItem,
    RescheduleJobRequest,
    RunNowResponse,
)
from schemas.job import Job, JobKind, JobSource, JobStatus


class JobService:
    def __init__(
        self,
        repo: JobRepository,
        notebook_changed: asyncio.Event,
        dispatcher: Dispatcher,
        aliases: dict[str, str],
        now: Callable[[], datetime],
        contacts: ContactService | None = None,
        templates: TemplateRepository | None = None,
    ) -> None:
        self._repo = repo
        self._notebook_changed = notebook_changed
        self._dispatcher = dispatcher
        self._aliases = aliases
        self._now = now
        self._contacts = contacts
        self._templates = templates

    def create(self, payload: CreateJobRequest) -> Job:
        target = (
            normalize_whatsapp_phone(payload.target_number)
            if payload.target_number
            else self._resolve_to(payload.to)
        )
        content, template_id = self._content_from_payload(payload)
        job = Job(
            id=str(uuid.uuid4()),
            title=payload.title,
            content=content,
            to=payload.to,
            target_number=target,
            kind=payload.kind,
            run_at=payload.run_at,
            cron_expr=payload.cron_expr,
            source=JobSource.SQLITE,
            status=JobStatus.SCHEDULED,
            created_by=self._created_by(payload.created_by),
            template_id=template_id,
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
        limit: int | None = None,
        phone: str | None = None,
    ) -> list[JobListItem]:
        resolved_phone = self._resolve_to(phone) if phone else None
        jobs = self._repo.list_jobs(
            status_filter, range_from, range_to, limit=limit, phone=resolved_phone
        )
        return [JobListItem.model_validate(job.model_dump()) for job in jobs]

    def cancel(self, job_id: str) -> None:
        job = self.get(job_id)
        if job.source is JobSource.YAML:
            raise YamlJobImmutable("edit routines.yaml to change this job")
        self._repo.update(_cancelled(job))
        self._notebook_changed.set()

    def reschedule(self, job_id: str, payload: RescheduleJobRequest) -> Job:
        job = self.get(job_id)
        if job.source is JobSource.YAML:
            raise YamlJobImmutable("edit routines.yaml to change this job")

        updates: dict[str, object] = {
            "enabled": True,
            "status": JobStatus.SCHEDULED,
            "last_error": None,
        }
        if payload.run_at is not None:
            updates["kind"] = JobKind.ONCE
            updates["run_at"] = payload.run_at
            updates["next_run_at"] = payload.run_at
            updates["cron_expr"] = None
        elif payload.cron_expr is not None:
            updates["kind"] = JobKind.CRON
            updates["cron_expr"] = payload.cron_expr
            updates["next_run_at"] = next_cron_utc(payload.cron_expr, self._now())
            updates["run_at"] = None

        updated = job.model_copy(update=updates)
        stored = self._repo.update(updated)
        self._notebook_changed.set()
        return stored

    async def run_now(self, job_id: str) -> RunNowResponse:
        job = self.get(job_id)
        dest = job.target_number or resolve_destination(job.to, self._aliases)
        now_instant = self._now()
        content_to_send = self._render_outbound(job, dest, now_instant)
        result = await self._dispatcher.send(phone_number=dest, content=content_to_send)
        self._notebook_changed.set()
        if not result.ok:
            self._repo.update(job.model_copy(update={"last_error": result.last_error}))
            raise GatekeeperError("gatekeeper did not accept the message")
        self._repo.update(
            job.model_copy(
                update={
                    "last_run_at": now_instant,
                    "last_status": "queued",
                    "last_error": None,
                }
            )
        )
        return RunNowResponse(status="queued", job_id=job.id)

    def _resolve_to(self, to: str) -> str:
        if self._contacts is not None:
            from_contact = self._contacts.resolve_to(to)
            if from_contact is not None:
                return from_contact
        return resolve_destination(to, self._aliases)

    def _created_by(self, raw: str | None) -> str:
        if raw is None or raw.strip() == "":
            return ""
        return self._resolve_to(raw.strip())

    def _content_from_payload(self, payload: CreateJobRequest) -> tuple[str, str | None]:
        template_id = payload.template_id
        catalog_body: str | None = None
        if template_id:
            if self._templates is None:
                raise EntityNotFound("template not found")
            stored = self._templates.get(template_id)
            if stored is None:
                raise EntityNotFound("template not found")
            catalog_body = stored.body
        if payload.content is not None:
            return payload.content, template_id
        if catalog_body is None:
            raise EntityNotFound("template not found")
        return catalog_body, template_id

    def _render_outbound(self, job: Job, dest: str, when: datetime) -> str:
        catalog_body: str | None = None
        if job.template_id and self._templates is not None:
            stored = self._templates.get(job.template_id)
            if stored is not None:
                catalog_body = stored.body
        dest_name: str | None = None
        if self._contacts is not None:
            dest_name = self._contacts.name_for_phone(dest)
        return render_outbound_message(
            stored_content=job.content,
            when=when,
            dest_name=dest_name,
            catalog_body=catalog_body,
        )


def _cancelled(job: Job) -> Job:
    if job.kind is JobKind.CRON:
        return job.model_copy(update={"enabled": False, "status": JobStatus.PAUSED})
    return job.model_copy(
        update={"enabled": False, "status": JobStatus.DONE, "next_run_at": None}
    )
