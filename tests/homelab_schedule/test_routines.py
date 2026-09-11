from datetime import UTC, datetime
from pathlib import Path

import pytest

from homelab_schedule.errors import YamlIdConflict
from homelab_schedule.repository import JobRepository
from homelab_schedule.routines import merge_routines
from homelab_schedule.store import connect
from schemas.job import Job, JobKind, JobSource, JobStatus


def _repo(tmp_path: Path) -> JobRepository:
    return JobRepository(connect(str(tmp_path / "schedule.sqlite")))


def _write_routines(path: Path, body: str) -> Path:
    path.write_text(body, encoding="utf-8")
    return path


def test_missing_file_is_noop(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    merge_routines(repo, tmp_path / "missing.yaml")
    assert repo.list_by_source(JobSource.YAML) == []


def test_merge_inserts_yaml_cron_job(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    yaml_path = _write_routines(
        tmp_path / "routines.yaml",
        """
- id: backup-status
  title: backup-status
  when: "0 9 * * 1"
  to: eu
  content: "Status do backup."
""",
    )
    merge_routines(repo, yaml_path, datetime(2026, 9, 11, 12, 0, tzinfo=UTC))
    job = repo.get("backup-status")
    assert job is not None
    assert job.source is JobSource.YAML
    assert job.kind is JobKind.CRON
    assert job.cron_expr == "0 9 * * 1"
    assert job.next_run_at is not None


def test_edit_yaml_updates_content_on_next_merge(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    yaml_path = tmp_path / "routines.yaml"
    _write_routines(
        yaml_path,
        """
- id: backup-status
  title: backup-status
  when: "0 9 * * 1"
  to: eu
  content: "old"
""",
    )
    merge_routines(repo, yaml_path, datetime(2026, 9, 11, 12, 0, tzinfo=UTC))
    first = repo.get("backup-status")
    assert first is not None
    previous_next = first.next_run_at
    _write_routines(
        yaml_path,
        """
- id: backup-status
  title: backup-status
  when: "0 9 * * 1"
  to: eu
  content: "new status"
""",
    )
    merge_routines(repo, yaml_path, datetime(2026, 9, 11, 12, 0, tzinfo=UTC))
    updated = repo.get("backup-status")
    assert updated is not None
    assert updated.content == "new status"
    assert updated.next_run_at == previous_next


def test_sqlite_id_conflict_is_rejected(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    repo.insert(
        Job(
            id="backup-status",
            title="chat",
            content="from sqlite",
            to="eu",
            kind=JobKind.ONCE,
            run_at=datetime(2026, 9, 12, 17, 0, tzinfo=UTC),
            source=JobSource.SQLITE,
        )
    )
    yaml_path = _write_routines(
        tmp_path / "routines.yaml",
        """
- id: backup-status
  title: backup-status
  when: "0 9 * * 1"
  to: eu
  content: "Status do backup."
""",
    )
    with pytest.raises(YamlIdConflict):
        merge_routines(repo, yaml_path)


def test_removed_yaml_id_pauses_routine(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    yaml_path = tmp_path / "routines.yaml"
    _write_routines(
        yaml_path,
        """
- id: backup-status
  title: backup-status
  when: "0 9 * * 1"
  to: eu
  content: "Status do backup."
""",
    )
    merge_routines(repo, yaml_path)
    _write_routines(yaml_path, "[]\n")
    merge_routines(repo, yaml_path)
    job = repo.get("backup-status")
    assert job is not None
    assert job.enabled is False
    assert job.status is JobStatus.PAUSED
