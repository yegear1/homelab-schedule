import json
from collections.abc import Callable
from datetime import datetime

import httpx
import pytest

from homelab_schedule.mcp_http import AgendaApi
from homelab_schedule.mcp_tools import (
    handle_cancel,
    handle_list_agenda,
    handle_reschedule,
    handle_schedule,
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

