from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

_WEEKDAYS_PT = (
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
    "domingo",
)

_WEEKDAYS_SHORT_PT = (
    "seg",
    "ter",
    "qua",
    "qui",
    "sex",
    "sáb",
    "dom",
)

_MONTHS_PT = (
    "",
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
)


def render_template(content: str, when: datetime, tz_name: str = "America/Sao_Paulo") -> str:
    """Replaces dynamic date/time placeholders with localized values in the target timezone."""
    if "{{" not in content:
        return content

    try:
        tz = ZoneInfo(tz_name)
        local_dt = when.astimezone(tz)
    except Exception:
        local_dt = when

    weekday_idx = local_dt.weekday()
    month_idx = local_dt.month

    replacements: dict[str, str] = {
        "{{date}}": local_dt.strftime("%d/%m/%Y"),
        "{{date_iso}}": local_dt.strftime("%Y-%m-%d"),
        "{{time}}": local_dt.strftime("%H:%M"),
        "{{weekday}}": _WEEKDAYS_SHORT_PT[weekday_idx],
        "{{day_name}}": _WEEKDAYS_PT[weekday_idx],
        "{{month_name}}": _MONTHS_PT[month_idx],
        "{{year}}": str(local_dt.year),
    }

    rendered = content
    for placeholder, value in replacements.items():
        rendered = rendered.replace(placeholder, value)

    return rendered
