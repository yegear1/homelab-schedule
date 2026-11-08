from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_jobs_page_implements_group_clustering_contract() -> None:
    page = (REPO_ROOT / "web/src/pages/JobsPage.svelte").read_text()
    table = (REPO_ROOT / "web/src/components/jobs/JobTable.svelte").read_text()
    grouping = (REPO_ROOT / "web/src/lib/jobs/agenda.ts").read_text()
    actions = (REPO_ROOT / "web/src/components/jobs/JobActions.svelte").read_text()

    assert "<JobTable" in page
    assert "groupJobs(jobs)" in table
    assert "groupId: string; items: JobListItem[]" in grouping
    assert "expandedGroups = $state(new Set<string>())" in table
    assert "aria-expanded={expandedGroups.has(row.groupId)}" in table
    assert "isAllExpanded ? 'Recolher todos' : 'Expandir todos'" in table
    assert "data-group-id={row.groupId}" in table
    assert "<colgroup>" in table
    assert "membros carregados" in table
    assert "groupId={row.groupId}" in table
    assert "anchors={false}" in table
    assert "api.runGroup(id)" in actions
    assert "api.cancelGroup(id)" in actions
