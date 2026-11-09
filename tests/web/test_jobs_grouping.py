from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENDA_DIR = REPO_ROOT / "web" / "src" / "features" / "agenda"
GROUPING_FILE = REPO_ROOT / "web" / "src" / "lib" / "jobs" / "agenda.ts"
STORE_FILE = REPO_ROOT / "web" / "src" / "stores" / "jobs.ts"


def test_jobs_page_implements_group_clustering_contract() -> None:
    page = (AGENDA_DIR / "AgendaPage.tsx").read_text(encoding="utf-8")
    table = (AGENDA_DIR / "cmp-jobs-table.tsx").read_text(encoding="utf-8")
    grouping = GROUPING_FILE.read_text(encoding="utf-8")
    store = STORE_FILE.read_text(encoding="utf-8")

    assert "<JobsTable" in page
    assert "data-group-id={groupId}" in table
    assert "expandedGroups" in table
    assert "groupedBatches" in table
    assert "aria-expanded={isExpanded}" in table
    assert "btn-group-pause-all" in table
    assert "btn-group-resume-all" in table
    assert "btn-group-snooze-all" in table

    assert "groupId: string; items: JobListItem[]" in grouping
    assert "function groupJobs(" in grouping

    assert "runGroup:" in store
    assert "cancelGroup:" in store
    assert "api.runGroup" in store
    assert "api.cancelGroup" in store
