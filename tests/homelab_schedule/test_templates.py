from datetime import UTC, datetime

from homelab_schedule.templates import render_outbound_message, render_template


def test_render_template_all_placeholders() -> None:
    # 2026-09-11 15:30 UTC -> 12:30 in America/Sao_Paulo (UTC-3)
    # 11 de setembro de 2026 é uma sexta-feira
    dt = datetime(2026, 9, 11, 15, 30, 0, tzinfo=UTC)

    content = (
        "Lembrete: {{day_name}} ({{weekday}}), dia {{date}} / {{date_iso}} "
        "às {{time}} de {{month_name}} de {{year}}."
    )
    rendered = render_template(content, dt, tz_name="America/Sao_Paulo")

    expected = (
        "Lembrete: sexta-feira (sex), dia 11/09/2026 / 2026-09-11 "
        "às 12:30 de setembro de 2026."
    )
    assert rendered == expected


def test_render_template_unknown_or_no_placeholders() -> None:
    dt = datetime(2026, 9, 11, 15, 30, 0, tzinfo=UTC)

    assert render_template("Texto simples sem tags.", dt) == "Texto simples sem tags."

    content = "Olá {{user}}, hoje é {{date}} e código {{code}}."
    rendered = render_template(content, dt, tz_name="America/Sao_Paulo")
    assert rendered == "Olá {{user}}, hoje é 11/09/2026 e código {{code}}."


def test_render_template_date_iso_not_eaten_by_date() -> None:
    dt = datetime(2026, 9, 11, 15, 30, 0, tzinfo=UTC)
    assert render_template("{{date_iso}}", dt) == "2026-09-11"


def test_render_template_name_variable() -> None:
    dt = datetime(2026, 9, 11, 15, 30, 0, tzinfo=UTC)
    rendered = render_template(
        "Oi {{name}}, hoje é {{date}}.",
        dt,
        variables={"name": "Mae"},
    )
    assert rendered == "Oi Mae, hoje é 11/09/2026."


def test_render_outbound_prefers_catalog_and_name() -> None:
    dt = datetime(2026, 9, 11, 15, 30, 0, tzinfo=UTC)
    sent = render_outbound_message(
        stored_content="snapshot {{name}}",
        when=dt,
        dest_name="Lia",
        catalog_body="Olá {{name}}, {{date}}.",
    )
    assert sent == "Olá Lia, 11/09/2026."
