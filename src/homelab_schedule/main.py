from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from homelab_schedule.aliases import parse_aliases
from homelab_schedule.clock import SystemClock
from homelab_schedule.config import Settings
from homelab_schedule.contacts_repository import ContactRepository
from homelab_schedule.contacts_router import router as contacts_router
from homelab_schedule.contacts_service import ContactService
from homelab_schedule.dispatch import Dispatcher, GatekeeperDispatcher
from homelab_schedule.errors import (
    Conflict,
    EntityNotFound,
    GatekeeperError,
    Unauthorized,
)
from homelab_schedule.health import ping
from homelab_schedule.housekeeping_router import router as housekeeping_router
from homelab_schedule.jobs_router import router as jobs_router
from homelab_schedule.jobs_service import JobService
from homelab_schedule.logging import configure_logging
from homelab_schedule.repository import JobRepository
from homelab_schedule.routines import merge_routines
from homelab_schedule.routines_router import router as routines_router
from homelab_schedule.store import connect
from homelab_schedule.templates_repository import TemplateRepository
from homelab_schedule.templates_router import router as templates_router
from homelab_schedule.templates_service import TemplateService
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
    configure_logging()
    clock = SystemClock()
    clock_now = now if now is not None else clock.now
    aliases = parse_aliases(resolved.whatsapp_aliases)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        conn = connect(resolved.database_path)
        repo = JobRepository(conn)
        routines_file = Path(resolved.routines_path)
        merge_routines(repo, routines_file, clock_now())
        notebook_changed = asyncio.Event()
        notebook_changed.set()
        http_client: httpx.AsyncClient | None = None
        active = dispatcher
        if active is None:
            http_client = httpx.AsyncClient(
                base_url=resolved.whatsapp_api_url.rstrip("/"),
                timeout=10.0,
            )
            active = GatekeeperDispatcher(http_client, resolved.whatsapp_api_key)
        contacts_repo = ContactRepository(conn)
        contact_service = ContactService(contacts_repo, repo)
        templates_repo = TemplateRepository(conn)
        template_service = TemplateService(templates_repo, repo)
        service = JobService(
            repo,
            notebook_changed,
            active,
            aliases,
            clock_now,
            contact_service,
            templates_repo,
        )
        stop = asyncio.Event()
        app.state.api_key = resolved.schedule_api_key
        app.state.job_service = service
        app.state.contact_service = contact_service
        app.state.template_service = template_service
        app.state.notebook_changed = notebook_changed
        app.state.conn = conn
        app.state.dispatcher = active
        app.state.repo = repo
        app.state.routines_path = routines_file
        app.state.clock_now = clock_now
        logging.getLogger("homelab_schedule").info("homelab-schedule started")
        tick_task = asyncio.create_task(
            run_tick(
                stop=stop,
                wake=notebook_changed,
                repo=repo,
                dispatcher=active,
                aliases=aliases,
                now=clock_now,
                cap_seconds=tick_cap_seconds,
                routines_path=routines_file,
                retention_days=resolved.job_retention_days,
                dest_name=contact_service.name_for_phone,
                template_body=templates_repo.body_for,
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
    app.include_router(routines_router)
    app.include_router(jobs_router)
    app.include_router(contacts_router)
    app.include_router(templates_router)
    app.include_router(housekeeping_router)

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

    @app.exception_handler(Conflict)
    async def conflict(_: Request, exc: Conflict) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=409)

    @app.exception_handler(GatekeeperError)
    async def bad_gateway(_: Request, exc: GatekeeperError) -> JSONResponse:
        return JSONResponse({"detail": exc.message}, status_code=502)
