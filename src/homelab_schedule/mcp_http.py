from __future__ import annotations

import json
from typing import cast
from zoneinfo import ZoneInfo

import httpx

from homelab_schedule.mcp_when import default_title, parse_period, parse_when
from schemas.job import JobKind

_LIST_LIMIT = 50


class AgendaToolError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class AgendaApi:
    def __init__(self, base_url: str, api_key: str, client: httpx.Client) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._client = client

    def create_job(
        self,
        *,
        when: str,
        content: str,
        to: str,
        title: str | None,
        variables: dict[str, str] | None = None,
        until: str | None = None,
        max_runs: int | None = None,
    ) -> dict[str, object]:
        try:
            kind, run_at, cron_expr = parse_when(when)
        except ValueError as exc:
            raise AgendaToolError(str(exc)) from exc
        payload: dict[str, object] = {
            "title": title if title else default_title(content),
            "content": content,
            "to": to,
            "kind": kind.value,
        }
        if kind is JobKind.ONCE and run_at is not None:
            payload["run_at"] = run_at.isoformat()
        if kind is JobKind.CRON and cron_expr is not None:
            payload["cron_expr"] = cron_expr
        if variables:
            payload["variables"] = variables
        if until:
            payload["until"] = until
        if max_runs is not None:
            payload["max_runs"] = max_runs
        response = self._request("POST", "/jobs", json=payload)
        return _json_object(response)

    def list_agenda(
        self,
        status: str = "upcoming",
        limit: int = 20,
        to: str | None = None,
        query: str | None = None,
        period: str | None = None,
    ) -> dict[str, object]:
        effective_limit = max(1, min(limit, _LIST_LIMIT))
        params: dict[str, str] = {
            "status": status,
            "limit": str(effective_limit),
        }
        if to and to.strip():
            params["phone"] = to.strip()
        if query and query.strip():
            params["query"] = query.strip()
        if period and period.strip():
            try:
                range_from, range_to = parse_period(period)
            except ValueError as exc:
                raise AgendaToolError(str(exc)) from exc
            params["from"] = range_from.astimezone(ZoneInfo("UTC")).isoformat()
            params["to"] = range_to.astimezone(ZoneInfo("UTC")).isoformat()

        response = self._request(
            "GET",
            "/jobs",
            params=params,
        )
        body = _json_object(response)
        jobs = _json_list(body.get("jobs"))
        short: list[dict[str, object]] = []
        for raw in jobs[:effective_limit]:
            item = _json_object_from_mapping(raw)
            short.append(
                {
                    "id": item.get("id"),
                    "when": item.get("next_run_at") or item.get("cron_expr"),
                    "to": item.get("to"),
                    "title": item.get("title"),
                    "status": item.get("status"),
                }
            )
        return {"jobs": short}

    def get_item(self, job_id: str) -> dict[str, object]:
        response = self._request("GET", f"/jobs/{job_id}")
        return _json_object(response)

    def cancel(self, job_id: str) -> dict[str, object]:
        self._request("POST", f"/jobs/{job_id}/cancel")
        return {"cancelled": job_id}

    def pause(self, job_id: str) -> dict[str, object]:
        response = self._request("POST", f"/jobs/{job_id}/pause")
        return _json_object(response)

    def resume(self, job_id: str) -> dict[str, object]:
        response = self._request("POST", f"/jobs/{job_id}/resume")
        return _json_object(response)

    def snooze(self, job_id: str, when: str) -> dict[str, object]:
        response = self._request("POST", f"/jobs/{job_id}/snooze", json={"when": when})
        return _json_object(response)

    def reschedule_job(self, *, job_id: str, when: str) -> dict[str, object]:
        try:
            kind, run_at, cron_expr = parse_when(when)
        except ValueError as exc:
            raise AgendaToolError(str(exc)) from exc
        payload: dict[str, object] = {}
        if kind is JobKind.ONCE and run_at is not None:
            payload["run_at"] = run_at.isoformat()
        if kind is JobKind.CRON and cron_expr is not None:
            payload["cron_expr"] = cron_expr
        response = self._request("POST", f"/jobs/{job_id}/reschedule", json=payload)
        return _json_object(response)

    def preview_job(
        self,
        *,
        when: str,
        content: str | None = None,
        to: str = "eu",
        title: str | None = None,
        template_id: str | None = None,
        variables: dict[str, str] | None = None,
        until: str | None = None,
        max_runs: int | None = None,
    ) -> dict[str, object]:
        payload: dict[str, object] = {
            "when": when,
            "to": to,
        }
        if content is not None:
            payload["content"] = content
        if title is not None:
            payload["title"] = title
        if template_id is not None:
            payload["template_id"] = template_id
        if variables:
            payload["variables"] = variables
        if until:
            payload["until"] = until
        if max_runs is not None:
            payload["max_runs"] = max_runs
        response = self._request("POST", "/jobs/preview", json=payload)
        return _json_object(response)

    def _request(
        self,
        method: str,
        path: str,
        json: dict[str, object] | None = None,
        params: dict[str, str] | None = None,
    ) -> httpx.Response:
        url = f"{self._base_url}{path}"
        try:
            response = self._client.request(
                method,
                url,
                headers={"x-api-key": self._api_key, "Content-Type": "application/json"},
                json=json,
                params=params,
                timeout=10.0,
            )
        except httpx.HTTPError as exc:
            raise AgendaToolError(
                f"API homelab-schedule indisponível em {self._base_url}"
            ) from exc
        return _raise_http(response, self._base_url)


def compact_json(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _raise_http(response: httpx.Response, base_url: str) -> httpx.Response:
    if response.status_code == 401:
        raise AgendaToolError("invalid or missing api key")
    if response.status_code == 404:
        detail = _detail(response)
        raise AgendaToolError(detail if detail != "request failed" else "job not found")
    if response.status_code == 409:
        raise AgendaToolError("edite routines.yaml")
    if response.status_code >= 500:
        raise AgendaToolError(f"API homelab-schedule indisponível em {base_url}")
    if response.status_code >= 400:
        raise AgendaToolError(_detail(response))
    return response


def _detail(response: httpx.Response) -> str:
    try:
        body: object = response.json()
    except ValueError:
        return "request failed"
    if isinstance(body, dict):
        detail = body.get("detail")
        if isinstance(detail, str):
            return detail
        if isinstance(detail, list) and len(detail) > 0:
            first = detail[0]
            if isinstance(first, dict):
                msg = first.get("msg")
                if isinstance(msg, str):
                    prefix = "Value error, "
                    if msg.startswith(prefix):
                        return msg[len(prefix) :]
                    return msg
    return "request failed"


def _json_object(response: httpx.Response) -> dict[str, object]:
    if response.status_code == 204:
        return {}
    payload: object = response.json()
    return _json_object_from_mapping(payload)


def _json_object_from_mapping(payload: object) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise AgendaToolError("unexpected API response")
    result: dict[str, object] = {}
    for key, value in payload.items():
        if isinstance(key, str):
            result[key] = cast(object, value)
    return result


def _json_list(payload: object) -> list[object]:
    if payload is None:
        return []
    if not isinstance(payload, list):
        raise AgendaToolError("unexpected API response")
    return list(payload)
