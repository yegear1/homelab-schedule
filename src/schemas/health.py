from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class JobMetrics(BaseModel):
    total: int = 0
    scheduled: int = 0
    done: int = 0
    paused: int = 0
    error: int = 0
    sqlite: int = 0
    yaml: int = 0
    enabled_scheduled: int = 0
    overdue: int = 0
    next_run_at: datetime | None = None


class RunMetrics(BaseModel):
    total: int = 0
    success: int = 0
    error: int = 0
    mean_duration_ms: float | None = None
    latest_run_at: datetime | None = None


class HealthMetricsResponse(BaseModel):
    status: Literal["ok", "attention_required"]
    generated_at: datetime
    window_hours: int = Field(ge=1, le=168)
    window_start: datetime
    jobs: JobMetrics
    runs: RunMetrics
    success_percentage: float | None
