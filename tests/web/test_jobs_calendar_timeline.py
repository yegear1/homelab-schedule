from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
JOBS_PAGE = REPO_ROOT / "web" / "src" / "pages" / "JobsPage.svelte"
TIMELINE_COMPONENT = REPO_ROOT / "web" / "src" / "components" / "JobTimelineView.svelte"
CALENDAR_COMPONENT = REPO_ROOT / "web" / "src" / "components" / "JobCalendarView.svelte"


def test_jobs_page_view_mode_switcher_contract() -> None:
    content = JOBS_PAGE.read_text(encoding="utf-8")

    # Verify component imports
    assert "import JobTimelineView from '../components/JobTimelineView.svelte';" in content
    assert "import JobCalendarView from '../components/JobCalendarView.svelte';" in content

    # Verify activeView state and allRuns state
    assert "let activeView = $state<'table' | 'timeline' | 'calendar'>('table');" in content
    assert "let allRuns = $state<JobRun[]>([]);" in content
    assert "loadAllRuns()" in content

    # Verify switcher DOM elements
    assert 'id="view-mode-switcher"' in content
    assert 'id="tab-view-table"' in content
    assert 'id="tab-view-timeline"' in content
    assert 'id="tab-view-calendar"' in content

    # Verify conditional render branches
    assert "activeView === 'table'" in content
    assert "activeView === 'timeline'" in content
    assert "activeView === 'calendar'" in content
    assert "<JobTimelineView" in content
    assert "<JobCalendarView" in content


def test_job_timeline_view_contract() -> None:
    assert TIMELINE_COMPONENT.exists()
    content = TIMELINE_COMPONENT.read_text(encoding="utf-8")

    # Assert modern Svelte 5 runes
    assert "let {" in content
    assert "}: Props = $props();" in content
    assert "export let" not in content
    assert "on:click" not in content
    assert "onclick=" in content

    # Assert DOM IDs and structure
    assert 'id="job-timeline-view"' in content
    assert 'id="timeline-filter-all"' in content
    assert 'id="timeline-filter-future"' in content
    assert 'id="timeline-filter-history"' in content
    assert 'id="timeline-future-section"' in content
    assert 'id="timeline-history-section"' in content
    assert 'id="btn-timeline-refresh-runs"' in content

    # Assert display of actions and indicators
    assert "Dead-Letter:" in content
    assert "duration_ms.toFixed(1)" in content
    assert "status_code" in content
    assert "getRelativeBadge" in content


def test_job_calendar_view_contract() -> None:
    assert CALENDAR_COMPONENT.exists()
    content = CALENDAR_COMPONENT.read_text(encoding="utf-8")

    # Assert modern Svelte 5 runes
    assert "let {" in content
    assert "}: Props = $props();" in content
    assert "export let" not in content
    assert "on:click" not in content
    assert "onclick=" in content

    # Assert DOM IDs and controls
    assert 'id="job-calendar-view"' in content
    assert 'id="calendar-current-month"' in content
    assert 'id="btn-calendar-today"' in content
    assert 'id="btn-calendar-prev"' in content
    assert 'id="btn-calendar-next"' in content
    assert 'id="calendar-grid"' in content
    assert 'id="calendar-day-detail"' in content

    # Assert grid weekdays and drilldown
    assert "['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']" in content
    assert "selectedDayEvents" in content
    assert "hasError" in content
    assert "scheduledCount" in content
    assert "runsCount" in content
