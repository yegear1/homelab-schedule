import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
TAILWIND_CONFIG = REPO_ROOT / "web" / "tailwind.config.js"
APP_CSS = REPO_ROOT / "web" / "src" / "app.css"


def test_tailwind_opacity_uses_slash_syntax_for_space_separated_rgb() -> None:
    config = TAILWIND_CONFIG.read_text(encoding="utf-8")
    assert "rgba(var(" not in config
    assert "rgb(var(${variableName}) /" in config


def _resolve_rgb(tokens: dict[str, str], name: str) -> tuple[int, ...]:
    value = tokens[name]
    visited = {name}
    while value.startswith("var("):
        alias = value.removeprefix("var(").removesuffix(")")
        assert alias not in visited, "Circular theme token alias"
        visited.add(alias)
        value = tokens[alias]
    channels = tuple(int(channel) for channel in value.split())
    assert len(channels) == 3
    assert all(0 <= channel <= 255 for channel in channels)
    return channels


def _luminance(channels: tuple[int, ...]) -> float:
    normalized = [channel / 255 for channel in channels]
    linear = [
        value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        for value in normalized
    ]
    return sum(
        value * weight for value, weight in zip(linear, (0.2126, 0.7152, 0.0722), strict=True)
    )


def test_app_css_defines_light_and_dark_surface_tokens() -> None:
    css = APP_CSS.read_text(encoding="utf-8")
    surfaces: list[tuple[int, ...]] = []
    for selector in (":root", "body.dark"):
        block = re.search(re.escape(selector) + r"\s*\{([^}]+)\}", css)
        assert block is not None
        tokens = dict(re.findall(r"(--[\w-]+):\s*([^;]+);", block[1]))
        surface = _resolve_rgb(tokens, "--color-surface")
        label = _resolve_rgb(tokens, "--color-on-surface")
        luminances = sorted((_luminance(surface), _luminance(label)))
        assert (luminances[1] + 0.05) / (luminances[0] + 0.05) >= 4.5
        surfaces.append(surface)
    assert surfaces[0] != surfaces[1]
    assert "html.dark" in css
