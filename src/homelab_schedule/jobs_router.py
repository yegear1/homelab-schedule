from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request, status

from homelab_schedule.errors import Unauthorized
from homelab_schedule.jobs_service import JobService
from schemas.api import CreateJobRequest, JobListFilter, JobListResponse
from schemas.job import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _service(request: Request) -> JobService:
    service = request.app.state.job_service
    if not isinstance(service, JobService):
        raise RuntimeError("job service is not configured")
    return service


def _require_api_key(
    request: Request,
    x_api_key: Annotated[str | None, Header()] = None,
) -> None:
    expected = request.app.state.api_key
    if not isinstance(expected, str) or x_api_key != expected:
        raise Unauthorized("invalid or missing api key")


Auth = Annotated[None, Depends(_require_api_key)]


@router.get("", response_model=JobListResponse)
def list_jobs(
    request: Request,
    _: Auth,
    status_filter: Annotated[JobListFilter, Query(alias="status")] = JobListFilter.UPCOMING,
    range_from: Annotated[datetime | None, Query(alias="from")] = None,
    range_to: Annotated[datetime | None, Query(alias="to")] = None,
) -> JobListResponse:
    jobs = _service(request).list_jobs(status_filter, range_from, range_to)
    return JobListResponse(jobs=jobs)


@router.post("", response_model=Job, status_code=status.HTTP_201_CREATED)
def create_job(request: Request, _: Auth, payload: CreateJobRequest) -> Job:
    return _service(request).create(payload)


@router.get("/{job_id}", response_model=Job)
def get_job(request: Request, _: Auth, job_id: str) -> Job:
    return _service(request).get(job_id)


@router.post("/{job_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
def cancel_job(request: Request, _: Auth, job_id: str) -> None:
    _service(request).cancel(job_id)


@router.post("/{job_id}/run", status_code=status.HTTP_202_ACCEPTED)
def run_job_now(request: Request, _: Auth, job_id: str) -> None:
    _service(request).run_now(job_id)
