from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator

from schemas.job import Job, JobKind, JobRun, JobSource, JobStatus


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
    variables: dict[str, str] = Field(default_factory=dict)
    until: datetime | None = None
    max_runs: int | None = None

    @model_validator(mode="after")
    def _kind_schedule_fields(self) -> "CreateJobRequest":
        if self.max_runs is not None and self.max_runs <= 0:
            raise ValueError("max_runs must be greater than 0")
        if self.content is None and not self.template_id:
            raise ValueError("content or template_id is required")
        if self.content is not None and self.template_id:
            raise ValueError("provide content or template_id, not both")
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
    last_error: str | None = None
    retry_count: int = 0
    variables: dict[str, str] = Field(default_factory=dict)
    until: datetime | None = None
    max_runs: int | None = None
    run_count: int = 0


class JobListResponse(BaseModel):
    jobs: list[JobListItem]


class JobRunListResponse(BaseModel):
    runs: list[JobRun]


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


class SnoozeJobRequest(BaseModel):
    until: datetime | None = None
    duration_minutes: int | None = None
    when: str | None = None

    @model_validator(mode="after")
    def _validate_snooze(self) -> "SnoozeJobRequest":
        has_when = bool(self.when and self.when.strip())
        if self.until is None and self.duration_minutes is None and not has_when:
            raise ValueError("at least one of until, duration_minutes, or when must be provided")
        if self.duration_minutes is not None and self.duration_minutes <= 0:
            raise ValueError("duration_minutes must be greater than 0")
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
    variables: dict[str, str] = Field(default_factory=dict)
    until: datetime | None = None
    max_runs: int | None = None

    @model_validator(mode="after")
    def _kind_schedule_fields(self) -> "CreateBatchJobsRequest":
        if self.max_runs is not None and self.max_runs <= 0:
            raise ValueError("max_runs must be greater than 0")
        if self.content is None and not self.template_id:
            raise ValueError("content or template_id is required")
        if self.content is not None and self.template_id:
            raise ValueError("provide content or template_id, not both")
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


class PreviewJobRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    to: str = "eu"
    target_number: str | None = None
    when: str | None = None
    kind: JobKind | None = None
    run_at: datetime | None = None
    cron_expr: str | None = None
    template_id: str | None = None
    variables: dict[str, str] = Field(default_factory=dict)
    until: datetime | None = None
    max_runs: int | None = None

    @model_validator(mode="after")
    def _validate_preview_fields(self) -> "PreviewJobRequest":
        if self.max_runs is not None and self.max_runs <= 0:
            raise ValueError("max_runs must be greater than 0")
        if self.content is not None and self.template_id:
            raise ValueError("provide content or template_id, not both")
        if not self.when and self.kind is None:
            raise ValueError("either when or kind must be provided")
        if self.when:
            from homelab_schedule.mcp_when import parse_when

            try:
                parse_when(self.when)
            except ValueError as exc:
                raise ValueError(str(exc)) from exc
        else:
            if self.kind is JobKind.ONCE and self.run_at is None:
                raise ValueError("kind=once requires run_at")
            if self.kind is JobKind.CRON:
                if self.cron_expr is None:
                    raise ValueError("kind=cron requires cron_expr")
                if len(self.cron_expr.split()) != 5:
                    raise ValueError("cron_expr must have five fields")
        return self


class PreviewJobResponse(BaseModel):
    title: str
    to: str
    target_number: str
    recipient_name: str | None = None
    kind: JobKind
    run_at: datetime | None = None
    cron_expr: str | None = None
    next_run_at: datetime | None = None
    next_run_at_local: str | None = None
    template_id: str | None = None
    raw_content: str
    rendered_content: str
    variables: dict[str, str] = Field(default_factory=dict)
    until: datetime | None = None
    max_runs: int | None = None

