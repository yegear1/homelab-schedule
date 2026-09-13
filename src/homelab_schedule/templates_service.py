from __future__ import annotations

import uuid

from homelab_schedule.errors import Conflict, EntityNotFound
from homelab_schedule.repository import JobRepository
from homelab_schedule.templates_repository import TemplateRepository
from schemas.message_template import (
    CreateTemplateRequest,
    MessageTemplate,
    UpdateTemplateRequest,
)


class TemplateService:
    def __init__(self, repo: TemplateRepository, jobs: JobRepository) -> None:
        self._repo = repo
        self._jobs = jobs

    def create(self, payload: CreateTemplateRequest) -> MessageTemplate:
        template = MessageTemplate(
            id=str(uuid.uuid4()),
            name=payload.name.strip(),
            body=payload.body,
        )
        return self._repo.insert(template)

    def get(self, template_id: str) -> MessageTemplate:
        template = self._repo.get(template_id)
        if template is None:
            raise EntityNotFound("template not found")
        return template

    def list_templates(self) -> list[MessageTemplate]:
        return self._repo.list_all()

    def update(self, template_id: str, payload: UpdateTemplateRequest) -> MessageTemplate:
        current = self.get(template_id)
        name = payload.name.strip() if payload.name is not None else current.name
        body = payload.body if payload.body is not None else current.body
        return self._repo.update(current.model_copy(update={"name": name, "body": body}))

    def delete(self, template_id: str) -> None:
        self.get(template_id)
        scheduled = self._jobs.count_scheduled_for_template(template_id)
        if scheduled > 0:
            raise Conflict("template has scheduled jobs")
        self._repo.delete(template_id)
