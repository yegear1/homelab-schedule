from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator


class RoutineSpec(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=120)
    when: str
    content: str = Field(min_length=1)
    to: str = "eu"
    variables: dict[str, str] = Field(default_factory=dict)
    until: datetime | None = None
    max_runs: int | None = None

    @field_validator("when")
    @classmethod
    def _five_field_cron(cls, value: str) -> str:
        if len(value.split()) != 5:
            raise ValueError("when must be a five-field cron expression")
        return value

    @model_validator(mode="after")
    def _validate_lifecycle(self) -> "RoutineSpec":
        if self.max_runs is not None and self.max_runs <= 0:
            raise ValueError("max_runs must be greater than 0")
        return self
