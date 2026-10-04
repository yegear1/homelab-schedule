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

    # State and handlers for tags
    assert "let filterTag = $state('');" in content
    assert "let availableTags = $state<string[]>([]);" in content
    assert "let createTags = $state<string[]>([]);" in content
    assert "let newTagInput = $state('');" in content
    assert "function addTag(" in content
    assert "function removeTag(" in content
    assert "async function loadTags()" in content

    # Filter section
    assert 'id="filter-tag"' in content
    assert 'id="tags-datalist"' in content

    # Modal form elements for tags
    assert 'id="section-tags"' in content
    assert 'id="input-tag"' in content
    assert 'id="btn-add-tag"' in content

    # Listing indicator and detail drawer inspector
    assert "badge-tag" in content
    assert 'id="detail-tags-card"' in content
