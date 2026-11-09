from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
AGENDA_DIR = REPO_ROOT / "web" / "src" / "features" / "agenda"
STORE_TS = REPO_ROOT / "web" / "src" / "stores" / "jobs.ts"


def test_jobs_page_and_snooze_modal_implement_lifecycle_contract() -> None:
    store_content = STORE_TS.read_text(encoding="utf-8")
    assert "api.snoozeGroup(groupId" in store_content
    assert "api.snoozeJob(id" in store_content
    assert "api.pauseJob(id)" in store_content
    assert "api.resumeJob(id)" in store_content
    assert "api.pauseGroup(groupId)" in store_content
    assert "api.resumeGroup(groupId)" in store_content

    # Verify UI elements and widgets
    composer_content = (AGENDA_DIR / "wdg-job-create.tsx").read_text(encoding="utf-8")
    inspector_content = (AGENDA_DIR / "wdg-job-inspector.tsx").read_text(encoding="utf-8")
    table_content = (AGENDA_DIR / "cmp-jobs-table.tsx").read_text(encoding="utf-8")
    page_content = "".join(p.read_text(encoding="utf-8") for p in AGENDA_DIR.glob("*.tsx"))

    assert 'id="create-until"' in composer_content
    assert 'id="create-max-runs"' in composer_content
    assert 'id="detail-until"' in inspector_content
    assert 'id="detail-runs"' in inspector_content
    for anchor in ("btn-detail-pause", "btn-detail-resume", "btn-detail-snooze"):
        assert anchor in inspector_content
    for anchor in ("btn-group-pause-all", "btn-group-resume-all", "btn-group-snooze-all"):
        assert anchor in table_content
    assert "<JobsTable" in page_content
    assert "<JobInspector" in page_content

