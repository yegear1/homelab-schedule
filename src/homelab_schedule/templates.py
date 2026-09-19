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


def render_template(
    content: str,
    when: datetime,
    tz_name: str = "America/Sao_Paulo",
    variables: dict[str, str] | None = None,
) -> str:
    """Replaces date/time and optional extra placeholders. Unknown tags stay literal."""
    if "{{" not in content:
        return content

    try:
        tz = ZoneInfo(tz_name)
        local_dt = when.astimezone(tz)
    except Exception:
        local_dt = when

    weekday_idx = local_dt.weekday()
    month_idx = local_dt.month

    replacements: dict[str, str] = {}
    if variables:
        for key, value in variables.items():
            replacements["{{" + key + "}}"] = value
    replacements.update(
        {
            "{{date}}": local_dt.strftime("%d/%m/%Y"),
            "{{date_iso}}": local_dt.strftime("%Y-%m-%d"),
            "{{time}}": local_dt.strftime("%H:%M"),
            "{{weekday}}": _WEEKDAYS_SHORT_PT[weekday_idx],
            "{{day_name}}": _WEEKDAYS_PT[weekday_idx],
            "{{month_name}}": _MONTHS_PT[month_idx],
            "{{year}}": str(local_dt.year),
        }
    )

    rendered = content
    for placeholder, value in sorted(
        replacements.items(), key=lambda item: len(item[0]), reverse=True
    ):
        rendered = rendered.replace(placeholder, value)

    return rendered


def outbound_body(*, stored_content: str, catalog_body: str | None) -> str:
    if catalog_body is not None:
        return catalog_body
    return stored_content


def render_outbound_message(
    *,
    stored_content: str,
    when: datetime,
    dest_name: str | None = None,
    catalog_body: str | None = None,
    tz_name: str = "America/Sao_Paulo",
) -> str:
    variables = {"name": dest_name} if dest_name else None
    return render_template(
        outbound_body(stored_content=stored_content, catalog_body=catalog_body),
        when,
        tz_name=tz_name,
        variables=variables,
    )


def extract_template_variables(
    when: datetime,
    dest_name: str | None = None,
    tz_name: str = "America/Sao_Paulo",
) -> dict[str, str]:
    try:
        tz = ZoneInfo(tz_name)
        local_dt = when.astimezone(tz)
    except Exception:
        local_dt = when

    weekday_idx = local_dt.weekday()
    month_idx = local_dt.month

    vars_dict: dict[str, str] = {
        "date": local_dt.strftime("%d/%m/%Y"),
        "date_iso": local_dt.strftime("%Y-%m-%d"),
        "time": local_dt.strftime("%H:%M"),
        "weekday": _WEEKDAYS_SHORT_PT[weekday_idx],
        "day_name": _WEEKDAYS_PT[weekday_idx],
        "month_name": _MONTHS_PT[month_idx],
        "year": str(local_dt.year),
    }
    if dest_name:
        vars_dict["name"] = dest_name
    return vars_dict
