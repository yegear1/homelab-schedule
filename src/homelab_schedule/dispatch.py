from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Protocol

import httpx

_LOG = logging.getLogger("homelab_schedule.dispatch")
_PERMANENT_FAIL = {401, 422}


@dataclass(frozen=True)
class DispatchResult:
    ok: bool
    status_code: int
    last_status: str | None
    last_error: str | None
    permanent: bool = False
    duration_ms: float = 0.0


class Dispatcher(Protocol):
    async def send(self, *, phone_number: str, content: str) -> DispatchResult: ...


class GatekeeperDispatcher:
    def __init__(self, client: httpx.AsyncClient, api_key: str) -> None:
        self._client = client
        self._api_key = api_key

    async def send(self, *, phone_number: str, content: str) -> DispatchResult:
        start = time.perf_counter()
        try:
            response = await self._client.post(
                "/send",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self._api_key,
                },
                json={
                    "phone_number": phone_number,
                    "content": content,
                    "quote_id": None,
                },
            )
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
        except httpx.HTTPError:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            _LOG.error("gatekeeper_unreachable", extra={"event": "gatekeeper_unreachable"})
            return DispatchResult(
                ok=False,
                status_code=0,
                last_status=None,
                last_error="gatekeeper unreachable",
                permanent=False,
                duration_ms=duration_ms,
            )
        return _interpret(response, duration_ms=duration_ms)


def _interpret(response: httpx.Response, duration_ms: float = 0.0) -> DispatchResult:
    if response.status_code == 202:
        return DispatchResult(
            ok=True,
            status_code=202,
            last_status="queued",
            last_error=None,
            permanent=False,
            duration_ms=duration_ms,
        )
    permanent = response.status_code in _PERMANENT_FAIL
    _LOG.error(
        "gatekeeper_rejected",
        extra={"event": "gatekeeper_rejected", "status_code": response.status_code},
    )
    return DispatchResult(
        ok=False,
        status_code=response.status_code,
        last_status=None,
        last_error="gatekeeper error",
        permanent=permanent,
        duration_ms=duration_ms,
    )
