from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, Request, status

from homelab_schedule.auth import Auth
from homelab_schedule.jobs_service import JobService
from schemas.api import (
    CreateBatchJobsRequest,
    CreateBatchJobsResponse,
    CreateJobRequest,
    GroupActionResponse,
    JobListFilter,
    JobListResponse,
    RescheduleJobRequest,
    RunNowResponse,
)
from schemas.job import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _service(request: Request) -> JobService:
    service = request.app.state.job_service
    if not isinstance(service, JobService):
        raise RuntimeError("job service is not configured")
    return service


@router.get("", response_model=JobListResponse)
def list_jobs(
    request: Request,
    _: Auth,
    status_filter: Annotated[JobListFilter, Query(alias="status")] = JobListFilter.UPCOMING,
    range_from: Annotated[datetime | None, Query(alias="from")] = None,
    range_to: Annotated[datetime | None, Query(alias="to")] = None,
    limit: Annotated[int | None, Query(ge=1, le=100)] = None,
    phone: Annotated[str | None, Query()] = None,
    group_id: Annotated[str | None, Query()] = None,
    query: Annotated[str | None, Query(description="Busca textual em título ou conteúdo")] = None,
) -> JobListResponse:
    jobs = _service(request).list_jobs(
        status_filter,
        range_from,
        range_to,
        limit=limit,
        phone=phone,
        group_id=group_id,
        query=query,
    )
    return JobListResponse(jobs=jobs)


@router.post("", response_model=Job, status_code=status.HTTP_201_CREATED)
def create_job(request: Request, _: Auth, payload: CreateJobRequest) -> Job:
    return _service(request).create(payload)


@router.post("/batch", response_model=CreateBatchJobsResponse, status_code=status.HTTP_201_CREATED)
def create_batch_jobs(
    request: Request, _: Auth, payload: CreateBatchJobsRequest
) -> CreateBatchJobsResponse:
    return _service(request).create_batch(payload)


@router.post("/group/{group_id}/cancel", response_model=GroupActionResponse)
def cancel_group(request: Request, _: Auth, group_id: str) -> GroupActionResponse:
    return _service(request).cancel_group(group_id)


@router.post(
    "/group/{group_id}/run",
    response_model=GroupActionResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_group_now(
    request: Request, _: Auth, group_id: str
) -> GroupActionResponse:
    return await _service(request).run_group_now(group_id)


@router.get("/{job_id}", response_model=Job)
def get_job(request: Request, _: Auth, job_id: str) -> Job:
    return _service(request).get(job_id)


@router.post("/{job_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
def cancel_job(request: Request, _: Auth, job_id: str) -> None:
    _service(request).cancel(job_id)


@router.post("/{job_id}/reschedule", response_model=Job)
def reschedule_job(
    request: Request,
    _: Auth,
    job_id: str,
    payload: RescheduleJobRequest,
) -> Job:
    return _service(request).reschedule(job_id, payload)


@router.post("/{job_id}/run", response_model=RunNowResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_job_now(request: Request, _: Auth, job_id: str) -> RunNowResponse:
    return await _service(request).run_now(job_id)
