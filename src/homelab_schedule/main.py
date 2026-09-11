from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from homelab_schedule.config import Settings
from homelab_schedule.errors import (
    DispatchNotReady,
    EntityNotFound,
    Unauthorized,
    YamlJobImmutable,
)
from homelab_schedule.health import ping
from homelab_schedule.jobs_router import router as jobs_router
from homelab_schedule.jobs_service import JobService
from homelab_schedule.repository import JobRepository
from homelab_schedule.store import connect
from schemas.api import HealthResponse


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings if settings is not None else Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        conn = connect(resolved.database_path)
        notebook_changed = asyncio.Event()
        repo = JobRepository(conn)
        app.state.api_key = resolved.schedule_api_key
        app.state.job_service = JobService(repo, notebook_changed)
        app.state.notebook_changed = notebook_changed
        app.state.conn = conn
        yield
        conn.close()

    app = FastAPI(title="homelab-schedule", lifespan=lifespan)
    _register_error_handlers(app)
    app.include_router(jobs_router)

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status=ping())

    return app


def _register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(Unauthorized)
    async def unauthorized(_: Request, exc: Unauthorized) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=401)

    @app.exception_handler(EntityNotFound)
    async def not_found(_: Request, exc: EntityNotFound) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=404)

    @app.exception_handler(YamlJobImmutable)
    async def conflict(_: Request, exc: YamlJobImmutable) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=409)

    @app.exception_handler(DispatchNotReady)
    async def not_implemented(_: Request, exc: DispatchNotReady) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=501)


app = create_app()
