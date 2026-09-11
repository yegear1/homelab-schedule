import asyncio

import httpx

from homelab_schedule.dispatch import GatekeeperDispatcher


def test_gatekeeper_posts_canonical_payload() -> None:
    asyncio.run(_assert_canonical_payload())


async def _assert_canonical_payload() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            202,
            json={
                "status": "queued",
                "message_id": "mid-1",
                "queue": "whatsapp:send:notifications",
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://gatekeeper.test"
    ) as client:
        dispatcher = GatekeeperDispatcher(client, "wa-secret")
        result = await dispatcher.send(
            phone_number="5511999998888@c.us",
            content="Pagar condomínio.",
        )

    assert result.ok
    assert result.last_status == "queued"
    assert len(seen) == 1
    request = seen[0]
    assert request.url.path == "/send"
    assert request.headers["x-api-key"] == "wa-secret"
    keys = {k.lower() for k in request.headers}
    assert "authorization" not in keys
    payload = request.content
    assert b"phone_number" in payload
    assert b"content" in payload
    assert b"quote_id" in payload
    assert b'"to"' not in payload
    assert b'"body"' not in payload
    assert b'"message"' not in payload
