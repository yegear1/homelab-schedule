from fastapi import APIRouter, Request, status

from homelab_schedule.auth import Auth
from homelab_schedule.contacts_service import ContactService
from schemas.contact import (
    Contact,
    ContactListResponse,
    CreateContactRequest,
    UpdateContactRequest,
)

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _service(request: Request) -> ContactService:
    service = request.app.state.contact_service
    if not isinstance(service, ContactService):
        raise RuntimeError("contact service is not configured")
    return service


@router.get("", response_model=ContactListResponse)
def list_contacts(request: Request, _: Auth) -> ContactListResponse:
    return ContactListResponse(contacts=_service(request).list_contacts())


@router.post("", response_model=Contact, status_code=status.HTTP_201_CREATED)
def create_contact(request: Request, _: Auth, payload: CreateContactRequest) -> Contact:
    return _service(request).create(payload)


@router.get("/{contact_id}", response_model=Contact)
def get_contact(request: Request, _: Auth, contact_id: str) -> Contact:
    return _service(request).get(contact_id)


@router.patch("/{contact_id}", response_model=Contact)
def patch_contact(
    request: Request, _: Auth, contact_id: str, payload: UpdateContactRequest
) -> Contact:
    return _service(request).update(contact_id, payload)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(request: Request, _: Auth, contact_id: str) -> None:
    _service(request).delete(contact_id)
