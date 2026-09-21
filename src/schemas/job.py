from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


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


class JobRunTrigger(StrEnum):
    SCHEDULE = "schedule"
    MANUAL = "manual"


class JobRunStatus(StrEnum):
    SUCCESS = "success"
    ERROR = "error"


class JobRun(BaseModel):
    id: str
    job_id: str
    ran_at: datetime
    trigger: JobRunTrigger
    status: JobRunStatus
    status_code: int
    duration_ms: float
    error_message: str | None = None


class Job(BaseModel):
    id: str
    title: str
    content: str
    to: str
    target_number: str = ""
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
    retry_count: int = 0
    created_by: str = ""
    template_id: str | None = None
    group_id: str | None = None
    variables: dict[str, str] = Field(default_factory=dict)
    until: datetime | None = None
    max_runs: int | None = None
    run_count: int = 0

    @model_validator(mode="after")
    def _kind_schedule_fields(self) -> "Job":
        if self.max_runs is not None and self.max_runs <= 0:
            raise ValueError("max_runs must be greater than 0")
        if self.kind is JobKind.ONCE:
            if self.run_at is None:
                raise ValueError("kind=once requires run_at")
            if self.until is not None and self.run_at > self.until:
                raise ValueError("run_at cannot be later than until")
        if self.kind is JobKind.CRON:
            if self.cron_expr is None:
                raise ValueError("kind=cron requires cron_expr")
            if len(self.cron_expr.split()) != 5:
                raise ValueError("cron_expr must have five fields")
        if not self.target_number and self.to:
            self.target_number = self.to
        return self
