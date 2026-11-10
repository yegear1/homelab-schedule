from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENDA_PAGE = REPO_ROOT / "web/src/features/agenda/AgendaPage.tsx"
TIMELINE_COMPONENT = REPO_ROOT / "web/src/features/agenda/cmp-jobs-timeline.tsx"
CALENDAR_COMPONENT = REPO_ROOT / "web/src/features/agenda/cmp-jobs-calendar.tsx"
FILTERS_COMPONENT = REPO_ROOT / "web/src/features/agenda/wdg-agenda-filters.tsx"


def test_jobs_page_view_mode_switcher_contract() -> None:
    page_content = AGENDA_PAGE.read_text()
    filters_content = FILTERS_COMPONENT.read_text()
    api_content = (REPO_ROOT / "web/src/lib/api.ts").read_text()
    assert "getAllJobRuns(" in api_content
    store = (REPO_ROOT / "web/src/stores/jobs.ts").read_text()
    assert "runs: JobRun[];" in store
    for anchor in (
        "view-mode-switcher", "tab-view-table", "tab-view-timeline", "tab-view-calendar"
    ):
        assert f'id="{anchor}"' in filters_content
    for component in (
        "JobsTable", "JobsTimeline", "JobsCalendar", "JobInspector"
    ):
        assert f"<{component}" in page_content


def test_job_timeline_view_contract() -> None:
    content = TIMELINE_COMPONENT.read_text()
    for anchor in (
        "job-timeline-view", "timeline-future-section", "timeline-history-section",
        "btn-timeline-refresh-runs",
    ):
        assert f'id="{anchor}"' in content
    assert "timeline-filter-${value}" in content
    assert "duration_ms" in content
    assert "status_code" in content
    assert "run.status" in content
    assert "100 tentativas globais" in content


def test_job_calendar_view_contract() -> None:
    content = CALENDAR_COMPONENT.read_text()
    for anchor in (
        "job-calendar-view", "calendar-current-month", "btn-calendar-today",
        "btn-calendar-prev", "btn-calendar-next", "calendar-grid", "calendar-day-detail",
    ):
        assert f'id="{anchor}"' in content
    for requirement in (
        "['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']",
        "selectedJobs",
        "recorrências não são expandidas",
    ):
        assert requirement in content

