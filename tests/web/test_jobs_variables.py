from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES_FILE = REPO_ROOT / "web" / "src" / "lib" / "types.ts"
JOBS_PAGE = REPO_ROOT / "web" / "src" / "pages" / "JobsPage.svelte"


def test_types_implements_variables_contract() -> None:
    content = TYPES_FILE.read_text(encoding="utf-8")
    assert "variables?: Record<string, string>;" in content


def test_jobs_page_implements_custom_variables_contract() -> None:
    content = JOBS_PAGE.read_text(encoding="utf-8")

    # State and handlers for key-value variable management
    assert "let createCustomVars = $state<Array<{ key: string; value: string }>>([])" in content
    assert "function addCustomVar()" in content
    assert "function removeCustomVar(key: string)" in content

    # Modal form elements for adding custom variables
    assert 'id="section-custom-variables"' in content
    assert 'id="btn-add-var"' in content
    assert 'id="input-var-key"' in content
    assert 'id="input-var-value"' in content

    # Listing indicator and detail drawer inspector
    assert 'badge-variable-count' in content
    assert 'detail-variables-card' in content
