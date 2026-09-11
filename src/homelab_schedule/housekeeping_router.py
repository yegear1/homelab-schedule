from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Query, Request

from homelab_schedule.auth import Auth
from homelab_schedule.repository import JobRepository
from schemas.api import PurgeJobsResponse

router = APIRouter(prefix="/housekeeping", tags=["housekeeping"])


@router.post("/purge", response_model=PurgeJobsResponse)
def purge_jobs(
    request: Request,
    _: Auth,
    days: Annotated[int, Query(ge=1, le=3650)] = 365,
) -> PurgeJobsResponse:
    repo = request.app.state.repo
    if not isinstance(repo, JobRepository):
        raise RuntimeError("job repository is not configured")
    clock_now = request.app.state.clock_now
    now = clock_now() if callable(clock_now) else datetime.now(UTC)
    cutoff = now - timedelta(days=days)
    deleted = repo.purge_old_jobs(cutoff)
    return PurgeJobsResponse(status="purged", deleted_count=deleted, retention_days=days)
