from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES_PAGE = REPO_ROOT / "web" / "src" / "pages" / "TemplatesPage.svelte"


def test_templates_page_implements_dynamic_variables_contract() -> None:
    content = TEMPLATES_PAGE.read_text(encoding="utf-8")

    # Verify VALID_TAGS includes new greeting and dynamic tags
    assert "'{{greeting}}'" in content
    assert "'{{greeting_lower}}'" in content
    assert "'{{saudacao}}'" in content
    assert "'{{period}}'" in content
    assert "'{{day}}'" in content
    assert "'{{month}}'" in content
    assert "'{{hour}}'" in content
    assert "'{{minute}}'" in content

    # Verify live preview resolves greeting dynamically
    assert "greetingLower" in content
    assert ".replace(/\\{\\{greeting\\}\\}/g, greeting)" in content
    assert ".replace(/\\{\\{greeting_lower\\}\\}/g, greetingLower)" in content

    # Verify UI placeholder buttons section for contextual greetings
    assert "Saudações Contextuais (Horário Local)" in content
    assert "onclick={() => insertPlaceholder(item.tag)}" in content
