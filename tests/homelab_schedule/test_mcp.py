import json
from collections.abc import Callable

import httpx

from homelab_schedule.mcp_http import AgendaApi
from homelab_schedule.mcp_tools import (
    handle_cancel,
    handle_list_agenda,
    handle_reschedule,
    handle_schedule,
)
from homelab_schedule.mcp_when import parse_when
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
