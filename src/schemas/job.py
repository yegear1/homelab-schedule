from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, model_validator


class JobKind(StrEnum):
    ONCE = "once"
    CRON = "cron"


class JobSource(StrEnum):
    SQLITE = "sqlite"
    YAML = "yaml"


class JobStatus(StrEnum):
    SCHEDULED = "scheduled"
    DONE = "done"
    PAUSED = "paused"
    ERROR = "error"


class Job(BaseModel):
    id: str
    title: str
    content: str
    to: str
    kind: JobKind
    run_at: datetime | None = None
    cron_expr: str | None = None
    enabled: bool = True
    source: JobSource = JobSource.SQLITE
    status: JobStatus = JobStatus.SCHEDULED
    next_run_at: datetime | None = None
    last_run_at: datetime | None = None
    last_status: str | None = None
    last_error: str | None = None

    @model_validator(mode="after")
    def _kind_schedule_fields(self) -> "Job":
        if self.kind is JobKind.ONCE and self.run_at is None:
            raise ValueError("kind=once requires run_at")
        if self.kind is JobKind.CRON:
            if self.cron_expr is None:
                raise ValueError("kind=cron requires cron_expr")
            if len(self.cron_expr.split()) != 5:
                raise ValueError("cron_expr must have five fields")
        return self
