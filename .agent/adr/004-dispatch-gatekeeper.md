# [ADR-004] Dispatch Exclusively via POST /send on Configured HTTP Gateway

- **Status:** Approved (Sanitized 2026-09-12 for public release)
- **Date:** 2026-09-11
- **Author(s):** yegear / design session

---

## 1. Problem Context

The scheduler must reliably deliver notifications when jobs mature. Embedding a messaging socket client, Redis task queue, or persistent chat session in this container would bloat memory and create cross-cutting maintenance issues. Outbound transmission must decouple behind an HTTP endpoint specified by `WHATSAPP_API_URL`.

## 2. Decision Taken

The scheduler communicates outbound messages strictly via HTTP `POST {WHATSAPP_API_URL}/send` with:

- Header: `x-api-key: {WHATSAPP_API_KEY}`
- JSON Payload: `phone_number` (E.164 normalized recipient), `content` (string message), and optional `quote_id`

Protocol Contract:
- `202 Accepted` with JSON containing `status: queued` represents successful job dispatch (`last_status='queued'`).
- Do NOT poll downstream delivery. Do NOT immediately retry upon 202.
- Transient network failures or 5xx errors: logged as `error` NDJSON; retry up to 3 times with exponential backoff.
- Permanent HTTP errors (401 Unauthorized, 422 Unprocessable Entity): immediate terminal failure (`last_status='error'`), skipping retries.
- Recipient aliases resolve to canonical `target_number` during job creation; background tick dispatches to this resolved number.

## 3. Alternatives Considered

- **Shared database or Redis queue with messaging service:** Tight architectural coupling and shared failure domains.
- **Embedded headless browser / Puppeteer:** Excessive RAM (>500 MB) and CPU overhead, violating homelab lightweight constraints.

## 4. Consequences and Trade-offs

### Positive

- Keeps the repository focused strictly on scheduling and timer dispatch.
- Decoupled `httpx` HTTP client allows pairing with any dispatch gateway that conforms to the canonical `/send` schema.

### Negative / Accepted Risks

- If the external gateway is offline, dispatch fails despite healthy local scheduler state (returns HTTP 502 on immediate run; logs `last_error` in background tick).
- End-to-end receipt confirmation by the handset/recipient cannot be verified by this scheduler.

## 5. References and Links

- `.agent/skills/whatsapp-dispatch/SKILL.md`
- `.agent/NOTES.md` (Active Contracts)
