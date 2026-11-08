from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
JOBS_PAGE = REPO_ROOT / "web/src/pages/JobsPage.svelte"
TIMELINE_COMPONENT = REPO_ROOT / "web/src/components/JobTimelineView.svelte"
CALENDAR_COMPONENT = REPO_ROOT / "web/src/components/JobCalendarView.svelte"


def test_jobs_page_view_mode_switcher_contract() -> None:
    content = JOBS_PAGE.read_text()
    state = (REPO_ROOT / "web/src/lib/jobs/agenda.svelte.ts").read_text()
    assert "getAllJobRuns(100)" in state
    assert "ReadState<JobRun[]>" in state
    for anchor in (
        "view-mode-switcher", "tab-view-table", "tab-view-timeline", "tab-view-calendar"
    ):
        assert f'id="{anchor}"' in content
    for component in (
        "JobTable", "JobTimelineView", "JobCalendarView", "JobInspector", "JobComposer"
    ):
        assert f"<{component}" in content


def test_job_timeline_view_contract() -> None:
    content = TIMELINE_COMPONENT.read_text()
    attempt = (REPO_ROOT / "web/src/components/jobs/JobAttempt.svelte").read_text()
    assert "}: Props = $props();" in content
    assert "export let" not in content
    assert "on:click" not in content
    for anchor in (
        "job-timeline-view", "timeline-filter-all", "timeline-filter-future",
        "timeline-filter-history", "timeline-future-section", "timeline-history-section",
        "btn-timeline-refresh-runs",
    ):
        assert f'id="{anchor}"' in content
    assert "relativeTime(" in content
    assert "duration_ms.toFixed(1)" in attempt
    assert "status_code" in attempt
    assert "runs.status === 'error'" in content
    assert "até 100 tentativas retidas" in content


def test_job_calendar_view_contract() -> None:
    content = CALENDAR_COMPONENT.read_text()
    assert "}: Props = $props();" in content
    assert "export let" not in content
    assert "on:click" not in content
    for anchor in (
        "job-calendar-view", "calendar-current-month", "btn-calendar-today",
        "btn-calendar-prev", "btn-calendar-next", "calendar-grid", "calendar-day-detail",
    ):
        assert f'id="{anchor}"' in content
    for requirement in (
        "['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']", "selectedDayEvents",
        "hasError", "scheduledCount", "runsCount", "ArrowRight", "ArrowDown",
        "aria-pressed={selectedDateKey === cell.key}", "não expande todas as ocorrências cron",
    ):
        assert requirement in content
