from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES_FILE = REPO_ROOT / "web" / "src" / "lib" / "types.ts"
AGENDA_DIR = REPO_ROOT / "web" / "src" / "features" / "agenda"


def test_types_implements_variables_contract() -> None:
    content = TYPES_FILE.read_text(encoding="utf-8")
    assert "variables?: Record<string, string>;" in content


def test_jobs_page_implements_custom_variables_contract() -> None:
    composer = (AGENDA_DIR / "wdg-job-create.tsx").read_text(encoding="utf-8")
    assert 'id="section-custom-variables"' in composer
    assert 'id="btn-add-var"' in composer
    assert 'input-var-key' in composer
    assert 'input-var-value' in composer

    inspector = (AGENDA_DIR / "wdg-job-inspector.tsx").read_text(encoding="utf-8")
    assert 'id="detail-variables-card"' in inspector

    table = (AGENDA_DIR / "cmp-jobs-table.tsx").read_text(encoding="utf-8")
    assert 'id="badge-variable-count"' in table
