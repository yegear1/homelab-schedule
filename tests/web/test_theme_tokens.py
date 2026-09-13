from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TAILWIND_CONFIG = REPO_ROOT / "web" / "tailwind.config.js"
APP_CSS = REPO_ROOT / "web" / "src" / "app.css"


def test_tailwind_opacity_uses_slash_syntax_for_space_separated_rgb() -> None:
    config = TAILWIND_CONFIG.read_text(encoding="utf-8")
    assert "rgba(var(" not in config
    assert "rgb(var(${variableName}) /" in config


def test_app_css_defines_light_and_dark_surface_tokens() -> None:
    css = APP_CSS.read_text(encoding="utf-8")
    assert "--color-surface: 255 255 255;" in css
    assert "--color-surface: 11 19 38;" in css
    assert "html.dark" in css
