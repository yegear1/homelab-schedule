from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_templates_page_implements_dynamic_variables_contract() -> None:
    components = REPO_ROOT / "web/src/components/templates"
    placeholders = (components / "placeholders.ts").read_text()
    tools = (components / "PlaceholderTools.svelte").read_text()
    editor = (components / "TemplateEditor.svelte").read_text()
    page = (REPO_ROOT / "web/src/pages/TemplatesPage.svelte").read_text()
    assert "<TemplateEditor" in page
    for tag in (
        "name", "greeting", "greeting_lower", "saudacao", "saudacao_lower", "period",
        "date", "date_iso", "time", "weekday", "day_name", "month_name", "year",
        "day", "month", "hour", "minute",
    ):
        assert f"'{tag}'" in placeholders
    assert "values[key] ?? tag" in placeholders
    assert "samplePreview(body)" in tools
    assert "oninsert(tag)" in tools
    assert "Prévia ilustrativa" in tools
    assert 'id="live-preview-box"' in tools
    assert 'id="unknown-tags-warning"' in tools
    assert "selectionStart" in editor
    assert "selectionEnd" in editor
    assert "setSelectionRange" in editor
