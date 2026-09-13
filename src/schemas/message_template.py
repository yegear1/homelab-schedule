from pydantic import BaseModel, Field


class MessageTemplate(BaseModel):
    id: str
    name: str
    body: str


class CreateTemplateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1)


class UpdateTemplateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    body: str | None = Field(default=None, min_length=1)


class TemplateListResponse(BaseModel):
    templates: list[MessageTemplate]
