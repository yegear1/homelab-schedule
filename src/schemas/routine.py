from pydantic import BaseModel, Field, field_validator


class RoutineSpec(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=120)
    when: str
    content: str = Field(min_length=1)
    to: str = "eu"

    @field_validator("when")
    @classmethod
    def _five_field_cron(cls, value: str) -> str:
        if len(value.split()) != 5:
            raise ValueError("when must be a five-field cron expression")
        return value
