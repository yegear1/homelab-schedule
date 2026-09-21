import json
from collections.abc import Callable
from datetime import datetime

import httpx
import pytest

from homelab_schedule.mcp_http import AgendaApi
from homelab_schedule.mcp_stdio import build_mcp
from homelab_schedule.mcp_tools import (
    handle_cancel,
    handle_get_item,
    handle_list_agenda,
    handle_pause,
    handle_preview,
    handle_reschedule,
    handle_resume,
    handle_schedule,
    handle_snooze,
)
from homelab_schedule.mcp_when import parse_period, parse_when
from homelab_schedule.store import APP_TZ
from schemas.job import JobKind


def test_parse_when_iso_is_once() -> None:
    kind, run_at, cron = parse_when("2026-09-12T14:00:00-03:00")
    assert kind is JobKind.ONCE
    assert run_at is not None
    assert cron is None


def test_parse_when_five_fields_is_cron() -> None:
    kind, run_at, cron = parse_when("0 9 * * 1")
    assert kind is JobKind.CRON
    assert run_at is None
    assert cron == "0 9 * * 1"


def _api(handler: Callable[[httpx.Request], httpx.Response]) -> AgendaApi:
    transport = httpx.MockTransport(handler)
    client = httpx.Client(transport=transport, base_url="http://schedule.test")
    return AgendaApi("http://schedule.test", "secret-key", client)


def test_schedule_posts_once_job_without_gatekeeper_fields() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            201,
            json={
                "id": "abc",
                "title": "condomínio",
                "content": "Pagar condomínio.",
                "to": "eu",
                "next_run_at": "2026-09-12T17:00:00+00:00",
            },
        )

    api = _api(handler)
    text = handle_schedule(
        api,
        when="2026-09-12T14:00:00-03:00",
        content="Pagar condomínio.",
        title="condomínio",
    )
    payload = json.loads(text)
    assert payload["id"] == "abc"
    assert payload["next_run_at"] == "2026-09-12T17:00:00+00:00"
    assert "error" not in payload
    assert len(seen) == 1
    body = json.loads(seen[0].content)
    assert body["kind"] == "once"
    assert "phone_number" not in body
    assert seen[0].headers["x-api-key"] == "secret-key"


def test_schedule_with_variables_posts_and_returns_variables() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            201,
            json={
                "id": "var-1",
                "title": "Aviso",
                "content": "Olá {{cliente}}",
                "to": "eu",
                "next_run_at": "2026-09-12T17:00:00+00:00",
                "variables": {"cliente": "Alice", "pedido": "999"},
            },
        )

    api = _api(handler)
    text = handle_schedule(
        api,
        when="2026-09-12T14:00:00-03:00",
        content="Olá {{cliente}}",
        title="Aviso",
        variables={"cliente": "Alice", "pedido": "999"},
    )
    payload = json.loads(text)
    assert payload["id"] == "var-1"
    assert payload["variables"] == {"cliente": "Alice", "pedido": "999"}
    assert len(seen) == 1
    body = json.loads(seen[0].content)
    assert body["variables"] == {"cliente": "Alice", "pedido": "999"}


def test_list_agenda_omits_content_and_caps() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        jobs = [
            {
                "id": f"j{i}",
                "title": f"t{i}",
                "to": "eu",
                "status": "error",
                "next_run_at": "2026-09-12T17:00:00+00:00",
                "content": "secret-should-not-leak",
            }
            for i in range(5)
        ]
        return httpx.Response(200, json={"jobs": jobs})

    text = handle_list_agenda(_api(handler), status="error", limit=2)
    payload = json.loads(text)
    assert "content" not in json.dumps(payload)
    assert len(payload["jobs"]) == 2
    assert len(seen) == 1
    assert seen[0].url.params["status"] == "error"
    assert seen[0].url.params["limit"] == "2"


def test_cancel_yaml_returns_edit_file_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "edit routines.yaml to change this job"})

    text = handle_cancel(_api(handler), "backup-status")
    payload = json.loads(text)
    assert payload["error"] == "edite routines.yaml"


def test_unavailable_api_mentions_url_not_key() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    text = handle_list_agenda(_api(handler))
    payload = json.loads(text)
    assert "http://schedule.test" in payload["error"]
    assert "secret-key" not in payload["error"]


def test_reschedule_posts_new_time() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "id": "j-123",
                "title": "condomínio",
                "to": "eu",
                "status": "scheduled",
                "next_run_at": "2026-09-13T13:00:00+00:00",
            },
        )

    text = handle_reschedule(_api(handler), "j-123", "2026-09-13T10:00:00-03:00")
    payload = json.loads(text)
    assert payload["id"] == "j-123"
    assert payload["next_run_at"] == "2026-09-13T13:00:00+00:00"
    assert len(seen) == 1
    assert seen[0].url.path == "/jobs/j-123/reschedule"
    body = json.loads(seen[0].content)
    assert "run_at" in body


def test_reschedule_yaml_returns_edit_file_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "edit routines.yaml to change this job"})

    text = handle_reschedule(_api(handler), "yaml-routine", "2026-09-13T10:00:00-03:00")
    payload = json.loads(text)
    assert payload["error"] == "edite routines.yaml"


def test_parse_when_iso_without_tz_uses_app_tz() -> None:
    kind, run_at, cron = parse_when("2026-09-12 14:00:00")
    assert kind is JobKind.ONCE
    assert run_at is not None
    assert run_at.tzinfo == APP_TZ
    assert cron is None


def test_parse_when_rejects_non_cron_five_words() -> None:
    with pytest.raises(ValueError, match="Não foi possível interpretar 'when'"):
        parse_when("cinco palavras que nao cron")


def test_parse_when_relative_intervals() -> None:
    ref = datetime(2026, 9, 19, 10, 0, 0, tzinfo=APP_TZ)

    # Notação curta
    _, dt_15m, _ = parse_when("+15m", now=ref)
    assert dt_15m == datetime(2026, 9, 19, 10, 15, 0, tzinfo=APP_TZ)

    _, dt_2h, _ = parse_when("2h", now=ref)
    assert dt_2h == datetime(2026, 9, 19, 12, 0, 0, tzinfo=APP_TZ)

    _, dt_1d, _ = parse_when("+1d", now=ref)
    assert dt_1d == datetime(2026, 9, 20, 10, 0, 0, tzinfo=APP_TZ)

    _, dt_30s, _ = parse_when("30s", now=ref)
    assert dt_30s == datetime(2026, 9, 19, 10, 0, 30, tzinfo=APP_TZ)

    _, dt_1w, _ = parse_when("1w", now=ref)
    assert dt_1w == datetime(2026, 9, 26, 10, 0, 0, tzinfo=APP_TZ)

    # Notação composta
    _, dt_comp, _ = parse_when("1h30m", now=ref)
    assert dt_comp == datetime(2026, 9, 19, 11, 30, 0, tzinfo=APP_TZ)

    # Frases em português
    _, dt_pt1, _ = parse_when("em 10 minutos", now=ref)
    assert dt_pt1 == datetime(2026, 9, 19, 10, 10, 0, tzinfo=APP_TZ)

    _, dt_pt2, _ = parse_when("daqui a 2 horas", now=ref)
    assert dt_pt2 == datetime(2026, 9, 19, 12, 0, 0, tzinfo=APP_TZ)

    _, dt_pt3, _ = parse_when("daqui a 1 hora e 30 minutos", now=ref)
    assert dt_pt3 == datetime(2026, 9, 19, 11, 30, 0, tzinfo=APP_TZ)

    _, dt_pt4, _ = parse_when("em 1 dia", now=ref)
    assert dt_pt4 == datetime(2026, 9, 20, 10, 0, 0, tzinfo=APP_TZ)


def test_parse_when_friendly_calendar() -> None:
    # Sábado, 19 de Setembro de 2026, 10:00 BRT
    ref = datetime(2026, 9, 19, 10, 0, 0, tzinfo=APP_TZ)

    _, dt_am1, _ = parse_when("amanhã 14h", now=ref)
    assert dt_am1 == datetime(2026, 9, 20, 14, 0, 0, tzinfo=APP_TZ)

    _, dt_am2, _ = parse_when("amanha às 15:30", now=ref)
    assert dt_am2 == datetime(2026, 9, 20, 15, 30, 0, tzinfo=APP_TZ)

    _, dt_hoje, _ = parse_when("hoje 18:00", now=ref)
    assert dt_hoje == datetime(2026, 9, 19, 18, 0, 0, tzinfo=APP_TZ)

    _, dt_depois, _ = parse_when("depois de amanhã 09:00", now=ref)
    assert dt_depois == datetime(2026, 9, 21, 9, 0, 0, tzinfo=APP_TZ)

    # Próxima segunda (19/09 é sábado -> segunda é 21/09)
    _, dt_seg, _ = parse_when("segunda 9h", now=ref)
    assert dt_seg == datetime(2026, 9, 21, 9, 0, 0, tzinfo=APP_TZ)

    # Próxima sexta (25/09)
    _, dt_sex, _ = parse_when("próxima sexta às 18h", now=ref)
    assert dt_sex == datetime(2026, 9, 25, 18, 0, 0, tzinfo=APP_TZ)

    # Apenas horário posterior no mesmo dia
    _, dt_hora_hoje, _ = parse_when("14:00", now=ref)
    assert dt_hora_hoje == datetime(2026, 9, 19, 14, 0, 0, tzinfo=APP_TZ)

    # Apenas horário anterior no mesmo dia (agenda para amanhã)
    _, dt_hora_amanha, _ = parse_when("09:00", now=ref)
    assert dt_hora_amanha == datetime(2026, 9, 20, 9, 0, 0, tzinfo=APP_TZ)

    # Horário de relógio acima de 12 sem prefixo (18h -> hoje às 18:00)
    _, dt_18h, _ = parse_when("18h", now=ref)
    assert dt_18h == datetime(2026, 9, 19, 18, 0, 0, tzinfo=APP_TZ)


def test_parse_when_invalid_inputs_raise_value_error() -> None:
    with pytest.raises(ValueError):
        parse_when("")

    with pytest.raises(ValueError):
        parse_when("abracadabra")

    with pytest.raises(ValueError):
        parse_when("25:00")

    with pytest.raises(ValueError):
        parse_when("+0m")


def test_schedule_posts_with_relative_when() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            201,
            json={
                "id": "rel-1",
                "title": "teste",
                "content": "Aviso em 15m.",
                "to": "eu",
                "next_run_at": "2026-09-19T13:15:00+00:00",
            },
        )

    api = _api(handler)
    text = handle_schedule(api, when="+15m", content="Aviso em 15m.")
    payload = json.loads(text)
    assert payload["id"] == "rel-1"
    assert "error" not in payload
    assert len(seen) == 1
    body = json.loads(seen[0].content)
    assert body["kind"] == "once"
    assert "run_at" in body


def test_schedule_with_invalid_when_returns_json_error() -> None:
    api = _api(lambda req: httpx.Response(200))
    text = handle_schedule(api, when="quando der na telha", content="Aviso.")
    payload = json.loads(text)
    assert "error" in payload
    assert "Não foi possível interpretar 'when'" in payload["error"]


def test_reschedule_with_invalid_when_returns_json_error() -> None:
    api = _api(lambda req: httpx.Response(200))
    text = handle_reschedule(api, "j-123", when="quando der na telha")
    payload = json.loads(text)
    assert "error" in payload
    assert "Não foi possível interpretar 'when'" in payload["error"]


def test_parse_period_anchors() -> None:
    fixed_now = datetime(2026, 9, 19, 10, 30, 0, tzinfo=APP_TZ)  # Saturday

    # hoje
    start, end = parse_period("hoje", now=fixed_now)
    assert start == datetime(2026, 9, 19, 0, 0, 0, tzinfo=APP_TZ)
    assert end == datetime(2026, 9, 19, 23, 59, 59, 999999, tzinfo=APP_TZ)

    # amanhã
    start, end = parse_period("amanhã", now=fixed_now)
    assert start == datetime(2026, 9, 20, 0, 0, 0, tzinfo=APP_TZ)
    assert end == datetime(2026, 9, 20, 23, 59, 59, 999999, tzinfo=APP_TZ)

    # ontem
    start, end = parse_period("ontem", now=fixed_now)
    assert start == datetime(2026, 9, 18, 0, 0, 0, tzinfo=APP_TZ)
    assert end == datetime(2026, 9, 18, 23, 59, 59, 999999, tzinfo=APP_TZ)

    # esta semana (Monday to Sunday)
    start, end = parse_period("esta semana", now=fixed_now)
    assert start == datetime(2026, 9, 14, 0, 0, 0, tzinfo=APP_TZ)
    assert end == datetime(2026, 9, 20, 23, 59, 59, 999999, tzinfo=APP_TZ)

    # próxima semana
    start, end = parse_period("próxima semana", now=fixed_now)
    assert start == datetime(2026, 9, 21, 0, 0, 0, tzinfo=APP_TZ)
    assert end == datetime(2026, 9, 27, 23, 59, 59, 999999, tzinfo=APP_TZ)

    # este mês
    start, end = parse_period("este mês", now=fixed_now)
    assert start == datetime(2026, 9, 1, 0, 0, 0, tzinfo=APP_TZ)
    assert end == datetime(2026, 9, 30, 23, 59, 59, 999999, tzinfo=APP_TZ)

    # próximo mês
    start, end = parse_period("próximo mês", now=fixed_now)
    assert start == datetime(2026, 10, 1, 0, 0, 0, tzinfo=APP_TZ)
    assert end == datetime(2026, 10, 31, 23, 59, 59, 999999, tzinfo=APP_TZ)


def test_parse_period_durations_and_iso() -> None:
    fixed_now = datetime(2026, 9, 19, 10, 0, 0, tzinfo=APP_TZ)

    # +7d / 7d / próximos 7 dias
    start, end = parse_period("7d", now=fixed_now)
    assert start == fixed_now
    assert end == datetime(2026, 9, 26, 10, 0, 0, tzinfo=APP_TZ)

    start_p, end_p = parse_period("próximos 3 dias", now=fixed_now)
    assert start_p == fixed_now
    assert end_p == datetime(2026, 9, 22, 10, 0, 0, tzinfo=APP_TZ)

    # -24h / últimos 7 dias
    start_past, end_past = parse_period("-24h", now=fixed_now)
    assert start_past == datetime(2026, 9, 18, 10, 0, 0, tzinfo=APP_TZ)
    assert end_past == fixed_now

    # ISO YYYY-MM-DD
    start_iso, end_iso = parse_period("2026-10-15", now=fixed_now)
    assert start_iso == datetime(2026, 10, 15, 0, 0, 0, tzinfo=APP_TZ)
    assert end_iso == datetime(2026, 10, 15, 23, 59, 59, 999999, tzinfo=APP_TZ)


def test_parse_period_invalid_raises_value_error() -> None:
    with pytest.raises(ValueError):
        parse_period("")

    with pytest.raises(ValueError):
        parse_period("período qualquer sem sentido")

    with pytest.raises(ValueError):
        parse_period("2026-99-99")


def test_list_agenda_forwards_advanced_filters() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"jobs": []})

    api = _api(handler)
    text = handle_list_agenda(
        api,
        status="all",
        limit=10,
        to="mae",
        query="remédio",
        period="hoje",
    )
    payload = json.loads(text)
    assert payload == {"jobs": []}
    assert len(seen) == 1
    params = seen[0].url.params
    assert params["status"] == "all"
    assert params["limit"] == "10"
    assert params["phone"] == "mae"
    assert params["query"] == "remédio"
    assert "from" in params
    assert "to" in params


def test_list_agenda_with_invalid_period_returns_json_error() -> None:
    api = _api(lambda req: httpx.Response(200))
    text = handle_list_agenda(api, period="ano retrasado que passou")
    payload = json.loads(text)
    assert "error" in payload
    assert "Não foi possível interpretar o período" in payload["error"]


def test_handle_preview_success() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "title": "Aluguel",
                "to": "eu",
                "target_number": "5511999998888@c.us",
                "recipient_name": "Yegear",
                "kind": "once",
                "next_run_at": "2027-09-12T17:00:00+00:00",
                "next_run_at_local": "2027-09-12 14:00:00 -03:00",
                "template_id": None,
                "raw_content": "Pagar {{name}}",
                "rendered_content": "Pagar Yegear",
                "variables": {"name": "Yegear"},
            },
        )

    api = _api(handler)
    text = handle_preview(
        api,
        when="amanhã 14h",
        content="Pagar {{name}}",
        to="eu",
        title="Aluguel",
        variables={"name": "Yegear"},
    )
    payload = json.loads(text)
    assert payload["title"] == "Aluguel"
    assert payload["target_number"] == "5511999998888@c.us"
    assert payload["rendered_content"] == "Pagar Yegear"
    assert payload["variables"] == {"name": "Yegear"}
    assert len(seen) == 1
    assert seen[0].url.path == "/jobs/preview"
    assert seen[0].headers["x-api-key"] == "secret-key"
    body = json.loads(seen[0].content)
    assert body["when"] == "amanhã 14h"
    assert body["content"] == "Pagar {{name}}"
    assert body["to"] == "eu"
    assert body["variables"] == {"name": "Yegear"}


def test_handle_preview_error_returns_clean_json() -> None:
    def handler_404(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"detail": "template not found"})

    api = _api(handler_404)
    text = handle_preview(api, when="amanhã 14h", template_id="inexistente")
    payload = json.loads(text)
    assert payload == {"error": "template not found"}

    def handler_422(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            422,
            json={"detail": [{"loc": ["body", "when"], "msg": "Value error, Expressão inválida"}]},
        )

    api_422 = _api(handler_422)
    text_422 = handle_preview(api_422, when="expressao_invalida")
    payload_422 = json.loads(text_422)
    assert payload_422 == {"error": "Expressão inválida"}


def test_handle_get_item_includes_variables() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "id": "job-vars-123",
                "title": "Aviso médico",
                "content": "Olá {{paciente}}, consulta às {{hora}}",
                "to": "5511999990000",
                "kind": "once",
                "status": "scheduled",
                "next_run_at": "2026-09-25T14:00:00+00:00",
                "source": "api",
                "variables": {"paciente": "Carlos", "hora": "14h"},
            },
        )

    api = _api(handler)
    text = handle_get_item(api, "job-vars-123")
    payload = json.loads(text)
    assert payload["id"] == "job-vars-123"
    assert payload["variables"] == {"paciente": "Carlos", "hora": "14h"}
    assert payload["source"] == "api"
    assert len(seen) == 1
    assert seen[0].url.path == "/jobs/job-vars-123"


def test_build_mcp_registers_preview_tool() -> None:
    api = _api(lambda req: httpx.Response(200))
    server = build_mcp(api)
    # Check that preview and schedule have variables parameter
    assert "preview" in server._tool_manager._tools
    preview_tool = server._tool_manager._tools["preview"]
    assert "when" in preview_tool.parameters["properties"]
    assert "content" in preview_tool.parameters["properties"]
    assert "template_id" in preview_tool.parameters["properties"]
    assert "variables" in preview_tool.parameters["properties"]

    assert "schedule" in server._tool_manager._tools
    schedule_tool = server._tool_manager._tools["schedule"]
    assert "variables" in schedule_tool.parameters["properties"]
    assert "until" in schedule_tool.parameters["properties"]
    assert "max_runs" in schedule_tool.parameters["properties"]

    assert "pause" in server._tool_manager._tools
    assert "resume" in server._tool_manager._tools
    assert "snooze" in server._tool_manager._tools


def test_handle_pause_and_resume() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path.endswith("/pause"):
            return httpx.Response(
                200, json={"id": "job-1", "status": "paused", "title": "Pausado"}
            )
        if request.url.path.endswith("/resume"):
            return httpx.Response(
                200, json={"id": "job-1", "status": "scheduled", "title": "Ativo"}
            )
        return httpx.Response(404)

    api = _api(handler)
    pause_text = handle_pause(api, "job-1")
    pause_data = json.loads(pause_text)
    assert pause_data["status"] == "paused"
    assert "/jobs/job-1/pause" in calls

    resume_text = handle_resume(api, "job-1")
    resume_data = json.loads(resume_text)
    assert resume_data["status"] == "scheduled"
    assert "/jobs/job-1/resume" in calls


def test_handle_snooze() -> None:
    seen_payload: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal seen_payload
        seen_payload = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "id": "job-1",
                "status": "scheduled",
                "next_run_at": "2026-09-20T22:00:00+00:00",
            },
        )

    api = _api(handler)
    res = handle_snooze(api, "job-1", when="2026-09-20T22:00:00+00:00")
    data = json.loads(res)
    assert data["status"] == "scheduled"
    assert "when" in seen_payload


def test_handle_schedule_with_until_and_max_runs() -> None:
    seen_payload: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal seen_payload
        seen_payload = json.loads(request.content)
        return httpx.Response(
            201,
            json={
                "id": "job-limits",
                "title": "Aviso com limites",
                "content": "Texto",
                "to": "eu",
                "next_run_at": "2026-09-20T22:00:00+00:00",
                "until": "2026-10-01T00:00:00+00:00",
                "max_runs": 10,
            },
        )

    api = _api(handler)
    res = handle_schedule(
        api,
        when="0 8 * * *",
        content="Texto",
        title="Aviso com limites",
        until="2026-10-01T00:00:00+00:00",
        max_runs=10,
    )
    data = json.loads(res)
    assert data["id"] == "job-limits"
    assert seen_payload["until"] == "2026-10-01T00:00:00+00:00"
    assert seen_payload["max_runs"] == 10


