from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import yaml

from homelab_schedule.cron import next_cron_utc
from homelab_schedule.errors import YamlIdConflict
from homelab_schedule.repository import JobRepository
from schemas.job import Job, JobKind, JobSource, JobStatus
from schemas.routine import RoutineSpec


def load_routine_specs(path: Path) -> list[RoutineSpec]:
    if not path.is_file():
        return []
    loaded: object = yaml.safe_load(path.read_text(encoding="utf-8"))
    if loaded is None:
        return []
    if not isinstance(loaded, list):
        raise ValueError("routines.yaml must be a list")
    specs = [_spec_from_item(item) for item in loaded]
    _reject_duplicate_ids(specs)
    return specs


def merge_routines(
    repo: JobRepository,
    path: Path,
    now: datetime | None = None,
) -> int:
    instant = now if now is not None else datetime.now(UTC)
    specs = load_routine_specs(path)
    _pause_removed_yaml_jobs(repo, {spec.id for spec in specs})
    for spec in specs:
        _upsert_yaml_job(repo, spec, instant)
    return len(specs)


def _spec_from_item(item: object) -> RoutineSpec:
    if not isinstance(item, dict):
        raise ValueError("each routine must be a mapping")
    payload: dict[str, object] = {}
    for key, value in item.items():
        if not isinstance(key, str):
            raise ValueError("routine keys must be strings")
        payload[key] = value
    return RoutineSpec.model_validate(payload)


def _reject_duplicate_ids(specs: list[RoutineSpec]) -> None:
    seen: set[str] = set()
    for spec in specs:
        if spec.id in seen:
            raise ValueError(f"duplicate routine id: {spec.id}")
        seen.add(spec.id)


def _pause_removed_yaml_jobs(repo: JobRepository, keep_ids: set[str]) -> None:
    for job in repo.list_by_source(JobSource.YAML):
        if job.id in keep_ids:
            continue
        repo.update(
            job.model_copy(update={"enabled": False, "status": JobStatus.PAUSED})
        )


def _upsert_yaml_job(repo: JobRepository, spec: RoutineSpec, now: datetime) -> None:
    existing = repo.get(spec.id)
    if existing is None:
        repo.insert(_job_from_spec(spec))
        return
    if existing.source is JobSource.SQLITE:
        raise YamlIdConflict(f"routine id conflicts with a sqlite job: {spec.id}")
    repo.update(_apply_spec(existing, spec, now))


def _job_from_spec(spec: RoutineSpec) -> Job:
    return Job(
        id=spec.id,
        title=spec.title,
        content=spec.content,
        to=spec.to,
        target_number=spec.to,
        kind=JobKind.CRON,
        cron_expr=spec.when,
        source=JobSource.YAML,
        status=JobStatus.SCHEDULED,
        enabled=True,
    )


def _apply_spec(existing: Job, spec: RoutineSpec, now: datetime) -> Job:
    cron_changed = existing.cron_expr != spec.when
    keep_schedule = existing.enabled and not cron_changed
    next_run = existing.next_run_at if keep_schedule else next_cron_utc(spec.when, now)
    return existing.model_copy(
        update={
            "title": spec.title,
            "content": spec.content,
            "to": spec.to,
            "target_number": spec.to,
            "cron_expr": spec.when,
            "kind": JobKind.CRON,
            "source": JobSource.YAML,
            "enabled": True,
            "status": JobStatus.SCHEDULED,
            "next_run_at": next_run,
        }
    )
