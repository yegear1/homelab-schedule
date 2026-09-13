from fastapi import APIRouter, Request, status

from homelab_schedule.auth import Auth
from homelab_schedule.templates_service import TemplateService
from schemas.message_template import (
    CreateTemplateRequest,
    MessageTemplate,
    TemplateListResponse,
    UpdateTemplateRequest,
)

router = APIRouter(prefix="/templates", tags=["templates"])


def _service(request: Request) -> TemplateService:
    service = request.app.state.template_service
    if not isinstance(service, TemplateService):
        raise RuntimeError("template service is not configured")
    return service


@router.get("", response_model=TemplateListResponse)
def list_templates(request: Request, _: Auth) -> TemplateListResponse:
    return TemplateListResponse(templates=_service(request).list_templates())


@router.post("", response_model=MessageTemplate, status_code=status.HTTP_201_CREATED)
def create_template(
    request: Request, _: Auth, payload: CreateTemplateRequest
) -> MessageTemplate:
    return _service(request).create(payload)


@router.get("/{template_id}", response_model=MessageTemplate)
def get_template(request: Request, _: Auth, template_id: str) -> MessageTemplate:
    return _service(request).get(template_id)


@router.patch("/{template_id}", response_model=MessageTemplate)
def patch_template(
    request: Request, _: Auth, template_id: str, payload: UpdateTemplateRequest
) -> MessageTemplate:
    return _service(request).update(template_id, payload)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(request: Request, _: Auth, template_id: str) -> None:
    _service(request).delete(template_id)
