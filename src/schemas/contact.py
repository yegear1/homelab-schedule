from pydantic import BaseModel, Field


class Contact(BaseModel):
    id: str
    name: str
    phone: str


class CreateContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=1, max_length=64)


class UpdateContactRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    phone: str | None = Field(default=None, min_length=1, max_length=64)


class ContactListResponse(BaseModel):
    contacts: list[Contact]
