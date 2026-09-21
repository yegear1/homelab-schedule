from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from schemas.contact import Contact
from schemas.job import (
    Job,
    JobKind,
    JobRun,
    JobRunStatus,
    JobRunTrigger,
    JobSource,
    JobStatus,
)
from schemas.message_template import MessageTemplate


class ExportMetadata(BaseModel):
    version: int = 1
    schema_version: int = 10
    exported_at: datetime
    counts: dict[str, int]


class ExportDataResponse(BaseModel):
    metadata: ExportMetadata
    contacts: list[Contact]
    templates: list[MessageTemplate]
    jobs: list[Job]
    job_runs: list[JobRun]


class ImportMode(StrEnum):
    MERGE = "merge"
    REPLACE = "replace"


class ContactImportItem(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=1, max_length=64)


class TemplateImportItem(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1)


class JobImportItem(BaseModel):
    id: str | None = None
    title: str = Field(min_length=1, max_length=120)
    content: str
    to: str = "eu"
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


class JobRunImportItem(BaseModel):
    id: str | None = None
    job_id: str
    ran_at: datetime
    trigger: JobRunTrigger
    status: JobRunStatus
    status_code: int
    duration_ms: float
    error_message: str | None = None


class ImportDataRequest(BaseModel):
    mode: ImportMode = ImportMode.MERGE
    contacts: list[ContactImportItem] = Field(default_factory=list)
    templates: list[TemplateImportItem] = Field(default_factory=list)
    jobs: list[JobImportItem] = Field(default_factory=list)
    job_runs: list[JobRunImportItem] = Field(default_factory=list)


class ImportCounts(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0


class ImportSummary(BaseModel):
    contacts: ImportCounts = Field(default_factory=ImportCounts)
    templates: ImportCounts = Field(default_factory=ImportCounts)
    jobs: ImportCounts = Field(default_factory=ImportCounts)
    job_runs: ImportCounts = Field(default_factory=ImportCounts)


class ImportDataResponse(BaseModel):
    status: str = "imported"
    mode: ImportMode
    summary: ImportSummary
    warnings: list[str] = Field(default_factory=list)


class FkViolation(BaseModel):
    table: str
    rowid: int
    parent: str
    fkid: int


class IntegrityCheckResponse(BaseModel):
    integrity_ok: bool
    details: list[str]
    foreign_keys_ok: bool
    fk_violations: list[FkViolation] = Field(default_factory=list)
