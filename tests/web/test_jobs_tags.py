from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES_FILE = REPO_ROOT / "web" / "src" / "lib" / "types.ts"
API_FILE = REPO_ROOT / "web" / "src" / "lib" / "api.ts"
JOBS_PAGE = REPO_ROOT / "web" / "src" / "pages" / "JobsPage.svelte"


def test_types_implements_tags_contract() -> None:
    content = TYPES_FILE.read_text(encoding="utf-8")
    assert "tags?: string[];" in content
    assert "export interface TagsResponse {" in content


def test_api_implements_tags_contract() -> None:
    content = API_FILE.read_text(encoding="utf-8")
    assert "tag?: string;" in content
    assert "async getTags(): Promise<string[]>" in content


def test_jobs_page_implements_tags_contract() -> None:
    content = JOBS_PAGE.read_text(encoding="utf-8")

    editor = (REPO_ROOT / "web/src/components/jobs/TagInput.svelte").read_text()
    advanced = (REPO_ROOT / "web/src/components/jobs/JobAdvancedFields.svelte").read_text()
    assert "<JobComposer" in content
    assert "bind:tags={draft.tags}" in advanced
    for anchor in ("section-tags", "input-tag", "btn-add-tag"):
        assert f'id="{anchor}"' in editor
    filters = (REPO_ROOT / "web/src/components/jobs/JobFilters.svelte").read_text()
    summary = (REPO_ROOT / "web/src/components/jobs/JobSummary.svelte").read_text()
    for anchor in ("filter-tag", "tags-datalist"):
        assert f'id="{anchor}"' in filters

    inspector = (REPO_ROOT / "web/src/components/jobs/JobInspector.svelte").read_text()
    # Listing indicator and detail drawer inspector
    assert "badge-tag" in summary
    assert 'id="detail-tags-card"' in inspector
