from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES_FILE = REPO_ROOT / "web" / "src" / "lib" / "types.ts"
API_FILE = REPO_ROOT / "web" / "src" / "lib" / "api.ts"
AGENDA_DIR = REPO_ROOT / "web" / "src" / "features" / "agenda"


def test_types_implements_tags_contract() -> None:
    content = TYPES_FILE.read_text(encoding="utf-8")
    assert "tags?: string[];" in content
    assert "export interface TagsResponse {" in content


def test_api_implements_tags_contract() -> None:
    content = API_FILE.read_text(encoding="utf-8")
    assert "tag?: string;" in content
    assert "async getTags(): Promise<string[]>" in content


def test_jobs_page_implements_tags_contract() -> None:
    editor = (AGENDA_DIR / "wdg-job-create.tsx").read_text(encoding="utf-8")
    for anchor in ("section-tags", "input-tag", "btn-add-tag"):
        assert f'id="{anchor}"' in editor

    filters = (AGENDA_DIR / "wdg-agenda-filters.tsx").read_text(encoding="utf-8")
    assert 'id="filter-tag"' in filters

    inspector = (AGENDA_DIR / "wdg-job-inspector.tsx").read_text(encoding="utf-8")
    assert 'id="detail-tags-card"' in inspector

    table = (AGENDA_DIR / "cmp-jobs-table.tsx").read_text(encoding="utf-8")
    assert "job.tags.map" in table

