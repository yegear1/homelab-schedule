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
    page_content = JOBS_PAGE.read_text(encoding="utf-8")
    assert "import SnoozeModal" in page_content
    assert "let createUntil = $state" in page_content
    assert "let createMaxRuns = $state" in page_content
    assert "handlePause" in page_content
    assert "handleResume" in page_content
    assert "handlePauseGroup" in page_content
    assert "handleResumeGroup" in page_content
    assert "openSnoozeJob" in page_content
    assert "openSnoozeGroup" in page_content

    # 3. Verify UI elements and widgets
    assert 'id="create-until"' in page_content
    assert 'id="create-max-runs"' in page_content
    assert 'id="detail-until"' in page_content
    assert 'id="detail-runs"' in page_content
    assert 'id="btn-detail-pause"' in page_content
    assert 'id="btn-detail-resume"' in page_content
    assert 'id="btn-detail-snooze"' in page_content
    assert 'id="btn-group-pause-all"' in page_content
    assert 'id="btn-group-resume-all"' in page_content
    assert 'id="btn-group-snooze-all"' in page_content
    assert "<SnoozeModal" in page_content
