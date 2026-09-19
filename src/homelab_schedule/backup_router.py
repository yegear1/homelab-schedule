from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status

from homelab_schedule.auth import Auth
from homelab_schedule.backup_service import BackupService
from schemas.backup import (
    ExportDataResponse,
    ImportDataRequest,
    ImportDataResponse,
    IntegrityCheckResponse,
)

router = APIRouter(prefix="/backup", tags=["backup"])


def _service(request: Request) -> BackupService:
    service = getattr(request.app.state, "backup_service", None)
    if not isinstance(service, BackupService):
        raise RuntimeError("backup service is not configured")
    return service


@router.get("/database")
def download_database(request: Request, _: Auth) -> Response:
    """Download a live SQLite binary backup (.sqlite3) of the database."""
    service = _service(request)
    data = service.backup_database_bytes()
    now_str = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    filename = f"homelab-schedule-backup-{now_str}.sqlite3"

    return Response(
        content=data,
        media_type="application/x-sqlite3",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/export", response_model=ExportDataResponse)
def export_data(
    request: Request,
    _: Auth,
    include_runs: Annotated[bool, Query()] = True,
    download: Annotated[bool, Query()] = False,
) -> Response | ExportDataResponse:
    """Export contacts, templates, jobs, and execution history as structured JSON."""
    service = _service(request)
    exported = service.export_data(include_runs=include_runs)

    if download:
        now_str = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
        filename = f"homelab-schedule-export-{now_str}.json"
        return Response(
            content=exported.model_dump_json(indent=2),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Cache-Control": "no-store",
            },
        )

    return exported


@router.post("/import", response_model=ImportDataResponse, status_code=status.HTTP_200_OK)
def import_data(
    request: Request,
    _: Auth,
    payload: ImportDataRequest,
) -> ImportDataResponse:
    """Import data bundle into SQLite with atomic transaction and validation."""
    service = _service(request)
    return service.import_data(payload)


@router.get("/integrity", response_model=IntegrityCheckResponse)
def check_integrity(request: Request, _: Auth) -> IntegrityCheckResponse:
    """Run SQLite PRAGMA integrity_check and foreign_key_check."""
    service = _service(request)
    return service.check_integrity()
