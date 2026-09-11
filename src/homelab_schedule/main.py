from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from homelab_schedule.aliases import parse_aliases
from homelab_schedule.clock import SystemClock
from homelab_schedule.config import Settings
from homelab_schedule.dispatch import Dispatcher, GatekeeperDispatcher
from homelab_schedule.errors import (
    EntityNotFound,
    GatekeeperError,
    Unauthorized,
    YamlJobImmutable,
)
from homelab_schedule.health import ping
from homelab_schedule.jobs_router import router as jobs_router
from homelab_schedule.jobs_service import JobService
from homelab_schedule.repository import JobRepository
from homelab_schedule.store import connect
from homelab_schedule.tick import run_tick
from schemas.api import HealthResponse


def create_app(
    settings: Settings | None = None,
    *,
    dispatcher: Dispatcher | None = None,
    now: Callable[[], datetime] | None = None,
    tick_cap_seconds: float = 300.0,
) -> FastAPI:
    resolved = settings if settings is not None else Settings()
    clock = SystemClock()
    clock_now = now if now is not None else clock.now
    aliases = parse_aliases(resolved.whatsapp_aliases)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        conn = connect(resolved.database_path)
        notebook_changed = asyncio.Event()
        repo = JobRepository(conn)
        http_client: httpx.AsyncClient | None = None
        active = dispatcher
        if active is None:
            http_client = httpx.AsyncClient(
                base_url=resolved.whatsapp_api_url.rstrip("/"),
                timeout=10.0,
            )
            active = GatekeeperDispatcher(http_client, resolved.whatsapp_api_key)
        service = JobService(repo, notebook_changed, active, aliases, clock_now)
        stop = asyncio.Event()
        app.state.api_key = resolved.schedule_api_key
        app.state.job_service = service
        app.state.notebook_changed = notebook_changed
        app.state.conn = conn
        app.state.dispatcher = active
        tick_task = asyncio.create_task(
            run_tick(
                stop=stop,
                wake=notebook_changed,
                repo=repo,
                dispatcher=active,
                aliases=aliases,
                now=clock_now,
                cap_seconds=tick_cap_seconds,
            )
        )
        yield
        stop.set()
        notebook_changed.set()
        await tick_task
        if http_client is not None:
            await http_client.aclose()
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

    @app.exception_handler(GatekeeperError)
    async def bad_gateway(_: Request, exc: GatekeeperError) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=502)
