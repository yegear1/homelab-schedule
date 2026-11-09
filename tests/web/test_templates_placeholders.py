from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_templates_page_implements_dynamic_variables_contract() -> None:
    templates_dir = REPO_ROOT / "web/src/features/templates"
    fixtures = (templates_dir / "templates.fixtures.ts").read_text()
    toolbar = (templates_dir / "wdg-placeholder-toolbar.tsx").read_text()
    preview = (templates_dir / "wdg-template-preview.tsx").read_text()
    editor = (templates_dir / "cmp-template-editor.tsx").read_text()
    page = (templates_dir / "TemplatesPage.tsx").read_text()
    assert "<TemplateEditor" in page
    for tag in (
        "name", "greeting", "saudacao", "date", "date_iso", "time", "weekday",
        "day_name", "month_name", "year", "hour", "minute",
    ):
        assert f"'{tag}'" in fixtures
    assert "SAMPLE_SIMULATION_VALUES" in fixtures
    assert "onInsertToken" in toolbar
    assert "Prévia ilustrativa" in preview
    assert 'id="live-preview-box"' in preview
    assert 'id="unknown-tags-warning"' in editor
    assert "selectionStart" in editor
    assert "selectionEnd" in editor
    assert "setSelectionRange" in editor

