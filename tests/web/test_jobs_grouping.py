from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
JOBS_PAGE = REPO_ROOT / "web" / "src" / "pages" / "JobsPage.svelte"


def test_jobs_page_implements_group_clustering_contract() -> None:
    content = JOBS_PAGE.read_text(encoding="utf-8")
    # Verify TypeScript interfaces for grouping
    assert "interface GroupedJobRow" in content
    assert "type JobTableRow = GroupedJobRow | SingleJobRow" in content
    assert "let jobTableRows = $derived.by<JobTableRow[]>" in content

    # Verify reactive collapse / expand controls
    assert "let collapsedGroups = $state<Set<string>>" in content
    assert "function toggleGroupCollapse" in content
    assert "function toggleAllGroups" in content

    # Verify template selectors for group master row and member rows
    assert "data-group-id={row.groupId}" in content
    assert "handleRunGroup(row.groupId)" in content
    assert "handleCancelGroup(row.groupId)" in content
    assert "subdirectory_arrow_right" in content
    assert "<colgroup>" in content
    assert "whitespace-nowrap" in content
