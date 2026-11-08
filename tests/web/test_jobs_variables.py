from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES_FILE = REPO_ROOT / "web" / "src" / "lib" / "types.ts"
JOBS_PAGE = REPO_ROOT / "web" / "src" / "pages" / "JobsPage.svelte"


def test_types_implements_variables_contract() -> None:
    content = TYPES_FILE.read_text(encoding="utf-8")
    assert "variables?: Record<string, string>;" in content


def test_jobs_page_implements_custom_variables_contract() -> None:
    content = JOBS_PAGE.read_text(encoding="utf-8")

    editor = (REPO_ROOT / "web/src/components/jobs/VariableEditor.svelte").read_text()
    advanced = (REPO_ROOT / "web/src/components/jobs/JobAdvancedFields.svelte").read_text()
    assert "<JobComposer" in content
    assert "bind:entries={draft.variables}" in advanced
    for anchor in ("section-custom-variables", "btn-add-var", "input-var-key", "input-var-value"):
        assert f'id="{anchor}"' in editor

    # Listing indicator and detail drawer inspector
    assert "badge-variable-count" in content
    assert "detail-variables-card" in content
