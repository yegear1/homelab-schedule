from __future__ import annotations

import uuid

from homelab_schedule.aliases import normalize_whatsapp_phone
from homelab_schedule.contacts_repository import ContactRepository
from homelab_schedule.errors import Conflict, EntityNotFound
from homelab_schedule.repository import JobRepository
from schemas.contact import Contact, CreateContactRequest, UpdateContactRequest


class ContactService:
    def __init__(self, repo: ContactRepository, jobs: JobRepository) -> None:
        self._repo = repo
        self._jobs = jobs

    def create(self, payload: CreateContactRequest) -> Contact:
        contact = Contact(
            id=str(uuid.uuid4()),
            name=payload.name.strip(),
            phone=normalize_whatsapp_phone(payload.phone),
        )
        return self._repo.insert(contact)

    def get(self, contact_id: str) -> Contact:
        contact = self._repo.get(contact_id)
        if contact is None:
            raise EntityNotFound("contact not found")
        return contact

    def list_contacts(self) -> list[Contact]:
        return self._repo.list_all()

    def update(self, contact_id: str, payload: UpdateContactRequest) -> Contact:
        current = self.get(contact_id)
        name = payload.name.strip() if payload.name is not None else current.name
        phone = (
            normalize_whatsapp_phone(payload.phone)
            if payload.phone is not None
            else current.phone
        )
        return self._repo.update(current.model_copy(update={"name": name, "phone": phone}))

    def delete(self, contact_id: str) -> None:
        contact = self.get(contact_id)
        scheduled = self._jobs.count_scheduled_for_phone(contact.phone)
        if scheduled > 0:
            raise Conflict("contact has scheduled jobs")
        self._repo.delete(contact_id)

    def resolve_to(self, to: str) -> str | None:
        by_id = self._repo.get(to)
        if by_id is not None:
            return by_id.phone
        by_name = self._repo.get_by_name(to)
        if by_name is not None:
            return by_name.phone
        return None

    def name_for_phone(self, phone: str) -> str | None:
        contact = self._repo.get_by_phone(phone)
        if contact is None:
            return None
        return contact.name
