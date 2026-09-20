from datetime import UTC, datetime

from homelab_schedule.templates import (
    extract_template_variables,
    render_outbound_message,
    render_template,
)


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


def test_render_template_contextual_greetings() -> None:
    # 08:00 local (11:00 UTC) -> Morning ("Bom dia", "manhã")
    dt_morning = datetime(2026, 9, 11, 11, 0, 0, tzinfo=UTC)
    msg_morning = render_template(
        "{{greeting}}, {{name}}! Desejo um(a) ótimo(a) {{period}}. {{saudacao_lower}} a todos!",
        dt_morning,
        variables={"name": "Alice"},
    )
    assert msg_morning == "Bom dia, Alice! Desejo um(a) ótimo(a) manhã. bom dia a todos!"

    # 14:00 local (17:00 UTC) -> Afternoon ("Boa tarde", "tarde")
    dt_afternoon = datetime(2026, 9, 11, 17, 0, 0, tzinfo=UTC)
    msg_afternoon = render_template(
        "{{greeting_lower}}! {{saudacao}}! Período: {{period}}.",
        dt_afternoon,
    )
    assert msg_afternoon == "boa tarde! Boa tarde! Período: tarde."

    # 20:00 local (23:00 UTC) -> Night ("Boa noite", "noite")
    dt_night = datetime(2026, 9, 11, 23, 0, 0, tzinfo=UTC)
    msg_night = render_template(
        "{{greeting}}, são {{hour}}:{{minute}} da {{period}}.",
        dt_night,
    )
    assert msg_night == "Boa noite, são 20:00 da noite."

    # 03:00 local (06:00 UTC) -> Late night / dawn ("Boa noite", "noite")
    dt_dawn = datetime(2026, 9, 12, 6, 0, 0, tzinfo=UTC)
    msg_dawn = render_template("{{greeting}}", dt_dawn)
    assert msg_dawn == "Boa noite"


def test_render_template_dynamic_calendar_and_clock_variables() -> None:
    # 2026-09-05 14:08 local -> 17:08 UTC
    dt = datetime(2026, 9, 5, 17, 8, 0, tzinfo=UTC)
    template = "Dia {{day}}/{{month}}/{{year}} às {{hour}}:{{minute}} ({{day_name}})."
    rendered = render_template(template, dt)
    assert rendered == "Dia 05/09/2026 às 14:08 (sábado)."


def test_render_template_day_and_day_name_no_collision() -> None:
    dt = datetime(2026, 9, 11, 15, 30, 0, tzinfo=UTC)
    template = "{{day_name}} dia {{day}}"
    rendered = render_template(template, dt)
    assert rendered == "sexta-feira dia 11"


def test_extract_template_variables_all_keys() -> None:
    dt = datetime(2026, 9, 11, 15, 30, 0, tzinfo=UTC)  # 12:30 local
    vars_dict = extract_template_variables(dt, dest_name="Carlos")
    assert vars_dict["name"] == "Carlos"
    assert vars_dict["date"] == "11/09/2026"
    assert vars_dict["date_iso"] == "2026-09-11"
    assert vars_dict["time"] == "12:30"
    assert vars_dict["day"] == "11"
    assert vars_dict["month"] == "09"
    assert vars_dict["year"] == "2026"
    assert vars_dict["hour"] == "12"
    assert vars_dict["minute"] == "30"
    assert vars_dict["weekday"] == "sex"
    assert vars_dict["day_name"] == "sexta-feira"
    assert vars_dict["month_name"] == "setembro"
    assert vars_dict["greeting"] == "Boa tarde"
    assert vars_dict["greeting_lower"] == "boa tarde"
    assert vars_dict["saudacao"] == "Boa tarde"
    assert vars_dict["saudacao_lower"] == "boa tarde"
    assert vars_dict["period"] == "tarde"


def test_render_template_custom_variables() -> None:
    from homelab_schedule.templates import render_outbound_message

    dt = datetime(2026, 9, 11, 15, 30, 0, tzinfo=UTC)  # 12:30 local, Boa tarde
    template = (
        "Olá {{name}}, consulta de {{especialidade}} agendada com {{medico}}. "
        "Protocolo: {{protocolo}}."
    )
    custom = {
        "especialidade": "Cardiologia",
        "medico": "Dra. Ana",
        "protocolo": "CARD-7788",
    }
    rendered = render_template(template, dt, variables={"name": "Maria", **custom})
    expected_maria = (
        "Olá Maria, consulta de Cardiologia agendada com Dra. Ana. "
        "Protocolo: CARD-7788."
    )
    assert rendered == expected_maria

    # Test via render_outbound_message
    outbound = render_outbound_message(
        stored_content=template,
        when=dt,
        dest_name="Maria Silva",
        custom_variables=custom,
    )
    expected_outbound = (
        "Olá Maria Silva, consulta de Cardiologia agendada com Dra. Ana. "
        "Protocolo: CARD-7788."
    )
    assert outbound == expected_outbound

    # Test extract_template_variables with custom_variables
    all_vars = extract_template_variables(dt, dest_name="Maria Silva", custom_variables=custom)
    assert all_vars["name"] == "Maria Silva"
    assert all_vars["especialidade"] == "Cardiologia"
    assert all_vars["medico"] == "Dra. Ana"
    assert all_vars["protocolo"] == "CARD-7788"
    assert all_vars["greeting"] == "Boa tarde"

    # Test unknown tags remain literal
    template_with_unknown = "Protocolo {{protocolo}} e chave {{desconhecida}}."
    rendered_unknown = render_template(template_with_unknown, dt, variables={"protocolo": "123"})
    assert rendered_unknown == "Protocolo 123 e chave {{desconhecida}}."

