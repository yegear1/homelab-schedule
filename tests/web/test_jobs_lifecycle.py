from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
JOBS_PAGE = REPO_ROOT / "web" / "src" / "pages" / "JobsPage.svelte"
SNOOZE_MODAL = REPO_ROOT / "web" / "src" / "components" / "SnoozeModal.svelte"


def test_jobs_page_and_snooze_modal_implement_lifecycle_contract() -> None:
    # 1. Verify SnoozeModal component
    assert SNOOZE_MODAL.exists()
    snooze_content = SNOOZE_MODAL.read_text(encoding="utf-8")
    assert "api.snoozeGroup(groupId" in snooze_content
    assert "api.snoozeJob(jobId" in snooze_content
    assert 'id="modal-snooze"' in snooze_content
    assert 'id="modal-snooze-until"' in snooze_content
    assert "setQuickOffset" in snooze_content

    # 2. Verify JobsPage bindings and handlers
    components = REPO_ROOT / "web/src/components/jobs"
    page_content = JOBS_PAGE.read_text() + "\n".join(
        path.read_text() for path in components.glob("*.svelte")
    )
    assert "import SnoozeModal" in page_content
    composer = (REPO_ROOT / "web/src/components/jobs/JobAdvancedFields.svelte").read_text()
    assert "<JobComposer" in page_content
    assert "api.pauseJob(id)" in page_content
    assert "api.resumeJob(id)" in page_content
    assert "api.pauseGroup(id)" in page_content
    assert "api.resumeGroup(id)" in page_content
    assert "snooze = true" in page_content
    assert "groupId ? null : job.id" in page_content

    # 3. Verify UI elements and widgets
    assert 'id="create-until"' in composer
    assert 'id="create-max-runs"' in composer
    assert 'id="detail-until"' in page_content
    assert 'id="detail-runs"' in page_content
    for anchor in (
        "btn-detail-pause", "btn-detail-resume", "btn-detail-snooze",
        "btn-group-pause-all", "btn-group-resume-all", "btn-group-snooze-all",
    ):
        assert anchor in page_content
    assert "<SnoozeModal" in page_content
