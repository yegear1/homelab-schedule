import asyncio
from pathlib import Path

from fastapi import APIRouter, Request

from homelab_schedule.auth import Auth
from homelab_schedule.repository import JobRepository
from homelab_schedule.routines import merge_routines
from schemas.api import ReloadRoutinesResponse

router = APIRouter(prefix="/routines", tags=["routines"])


@router.post("/reload", response_model=ReloadRoutinesResponse)
def reload_routines(request: Request, _: Auth) -> ReloadRoutinesResponse:
    repo = request.app.state.repo
    if not isinstance(repo, JobRepository):
        raise RuntimeError("job repository is not configured")
    routines_path = request.app.state.routines_path
    if not isinstance(routines_path, Path):
        raise RuntimeError("routines path is not configured")
    clock_now = request.app.state.clock_now
    now = clock_now() if callable(clock_now) else None
    count = merge_routines(repo, routines_path, now)
    notebook_changed = request.app.state.notebook_changed
    if isinstance(notebook_changed, asyncio.Event):
        notebook_changed.set()
    return ReloadRoutinesResponse(status="reloaded", count=count)
