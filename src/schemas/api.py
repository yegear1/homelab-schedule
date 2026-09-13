from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator

from schemas.job import Job, JobKind, JobSource, JobStatus


class JobListFilter(StrEnum):
    UPCOMING = "upcoming"
    DONE = "done"
    PAUSED = "paused"
    ERROR = "error"
    ALL = "all"


class HealthResponse(BaseModel):
    status: str = "ok"


class CreateJobRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str | None = Field(default=None, min_length=1)
    to: str = "eu"
    target_number: str | None = None
    kind: JobKind
    run_at: datetime | None = None
    cron_expr: str | None = None
    created_by: str | None = None
    template_id: str | None = None
    group_id: str | None = None

    @model_validator(mode="after")
    def _kind_schedule_fields(self) -> "CreateJobRequest":
        if self.content is None and not self.template_id:
            raise ValueError("content or template_id is required")
        if self.content is not None and self.template_id:
            raise ValueError("provide content or template_id, not both")
        if self.kind is JobKind.ONCE and self.run_at is None:
            raise ValueError("kind=once requires run_at")
        if self.kind is JobKind.CRON:
            if self.cron_expr is None:
                raise ValueError("kind=cron requires cron_expr")
            if len(self.cron_expr.split()) != 5:
                raise ValueError("cron_expr must have five fields")
        return self


class JobListItem(BaseModel):
    id: str
    title: str
    to: str
    target_number: str = ""
    kind: JobKind
    run_at: datetime | None = None
    cron_expr: str | None = None
    enabled: bool
    source: JobSource
    status: JobStatus
    next_run_at: datetime | None = None
    last_run_at: datetime | None = None
    last_status: str | None = None
    created_by: str = ""
    template_id: str | None = None
    group_id: str | None = None


class JobListResponse(BaseModel):
    jobs: list[JobListItem]


class RunNowResponse(BaseModel):
    status: str
    job_id: str


class RescheduleJobRequest(BaseModel):
    run_at: datetime | None = None
    cron_expr: str | None = None

    @model_validator(mode="after")
    def _validate_fields(self) -> "RescheduleJobRequest":
        if self.run_at is None and self.cron_expr is None:
            raise ValueError("either run_at or cron_expr must be provided")
        if self.cron_expr is not None and len(self.cron_expr.split()) != 5:
            raise ValueError("cron_expr must have five fields")
        return self


class ReloadRoutinesResponse(BaseModel):
    status: str = "reloaded"
    count: int


class PurgeJobsResponse(BaseModel):
    status: str = "purged"
    deleted_count: int
    retention_days: int


class CreateBatchJobsRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str | None = Field(default=None, min_length=1)
    recipients: list[str] = Field(min_length=1)
    kind: JobKind
    run_at: datetime | None = None
    cron_expr: str | None = None
    created_by: str | None = None
    template_id: str | None = None

    @model_validator(mode="after")
    def _kind_schedule_fields(self) -> "CreateBatchJobsRequest":
        if self.content is None and not self.template_id:
            raise ValueError("content or template_id is required")
        if self.content is not None and self.template_id:
            raise ValueError("provide content or template_id, not both")
        if self.kind is JobKind.ONCE and self.run_at is None:
            raise ValueError("kind=once requires run_at")
        if self.kind is JobKind.CRON:
            if self.cron_expr is None:
                raise ValueError("kind=cron requires cron_expr")
            if len(self.cron_expr.split()) != 5:
                raise ValueError("cron_expr must have five fields")
        clean_recipients = [r.strip() for r in self.recipients if r.strip()]
        if not clean_recipients:
            raise ValueError("recipients list cannot be empty")
        self.recipients = clean_recipients
        return self


class CreateBatchJobsResponse(BaseModel):
    group_id: str
    count: int
    jobs: list[Job]


class GroupActionResponse(BaseModel):
    group_id: str
    affected: int
    status: str

