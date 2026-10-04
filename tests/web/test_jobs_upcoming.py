from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES_FILE = REPO_ROOT / "web" / "src" / "lib" / "types.ts"
API_FILE = REPO_ROOT / "web" / "src" / "lib" / "api.ts"
JOBS_PAGE = REPO_ROOT / "web" / "src" / "pages" / "JobsPage.svelte"


def test_upcoming_runs_types_and_api_contract() -> None:
    types_content = TYPES_FILE.read_text(encoding="utf-8")
    assert "export interface UpcomingRunItem" in types_content
    assert "run_at: string;" in types_content
    assert "run_at_local: string;" in types_content
    assert "time_local: string;" in types_content
    assert "formatted_date: string;" in types_content

    assert "export interface UpcomingRunsResponse" in types_content
    assert "total_projected: number;" in types_content
    assert "runs: UpcomingRunItem[];" in types_content

    api_content = API_FILE.read_text(encoding="utf-8")
    assert "getUpcomingRuns(" in api_content
    assert "/jobs/${encodeURIComponent(id)}/upcoming" in api_content


def test_jobs_page_upcoming_runs_contract() -> None:
    content = JOBS_PAGE.read_text(encoding="utf-8")

    # State and functions
    assert "selectedJobUpcoming = $state<UpcomingRunItem[]>([]);" in content
    assert "loadingUpcoming = $state(false);" in content
    assert "loadJobUpcoming(" in content

    # DOM elements in detail drawer
    assert 'id="detail-upcoming-card"' in content
    assert 'id="btn-refresh-upcoming"' in content
    assert 'id="upcoming-loading"' in content
    assert 'id="upcoming-empty"' in content
    assert 'id="upcoming-list"' in content
