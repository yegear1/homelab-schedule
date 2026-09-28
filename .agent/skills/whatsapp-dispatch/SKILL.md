---
name: whatsapp-dispatch
description: Dispatch scheduled agenda messages via POST /send with phone_number, content, and x-api-key, treating 202 Accepted as success without polling.
---

# Gateway HTTP Dispatch (`whatsapp-dispatch`)

Canonical specification for dispatching agenda notification messages through the HTTP gateway in homelab-schedule.

## 1. Scope & Blast Radius

- **MUTABLE PATHS:** `src/homelab_schedule/dispatcher.py`, `tests/test_dispatcher*.py`.
- **IMMUTABLE PATHS:** Database migrations (`src/db/**`), MCP tools (`src/homelab_schedule/mcp.py`), `.env`.
- **FORBIDDEN ACTIONS:**
  - MUST NOT send prohibited payload keys (`to`, `body`, `message`) to `POST /send`.
  - MUST NOT send `Authorization: Bearer` headers; use strictly `x-api-key: {WHATSAPP_API_KEY}`.
  - MUST NOT treat HTTP `202 Accepted` as failure or attempt immediate re-dispatch (causes message duplication).
  - MUST NOT record recipient phone numbers, message bodies, or `request_id` as log stream fields.
  - MUST NOT implement external queue polling or delivery receipt webhooks in this service.

## 2. When to Use (Triggers)

The agent MUST activate this skill when:
- Executing message dispatch from the scheduler due-tick loop.
- Executing on-demand manual job dispatch via `POST /jobs/{id}/run`.
- Normalizing target aliases to E.164 phone numbers via `WHATSAPP_ALIASES`.
- Handling gateway response status codes (`202 Accepted`, `401 Unauthorized`, `422 Unprocessable`, `5xx`).

The agent MUST NOT activate this skill when:
- Scheduling, modifying, or querying jobs (activate `agenda-job` or `anotar-agenda`).
- Operating the scheduler tick coroutine (activate `due-tick`).
- Filing third-party bug reports (activate `github-bug-issue`).

## 3. Required Tools & Prerequisites

- **Tools / MCPs:** `uv run pytest tests/test_dispatcher.py`.
- **Pre-Conditions:** Configured `WHATSAPP_API_URL` and `WHATSAPP_API_KEY` in environment; mock transport for tests (NEVER dispatch real messages during automated tests).

## 4. Conflict Resolution & Precedence

Precedence order when rules conflict:
1. Security, Credentials & Blast Radius (No credentials or recipient PII in stream fields, mock all test HTTP traffic)
2. Falsifiable Invariants & Automated Verification (Strict payload schema: phone_number, content, quote_id, x-api-key)
3. Task Specifications & Performance (202 Accepted is terminal success, no delivery polling)
4. Style & Formatting Conventions (Standard library logging with NDJSON formatting)

If an unresolvable rule conflict occurs, the agent MUST halt execution and request human clarification.

## 5. Operational Procedure

### Step 1: Recipient Resolution & Payload Construction
1. Resolve recipient identifier:
   - Check `WHATSAPP_ALIASES` mapping.
   - If target already has chat JID or suffix (e.g., `@s.whatsapp.net`, `@g.us`), preserve format.
   - Otherwise, normalize to digits-only phone number.
2. Construct dispatch payload strictly matching gateway contract:
   ```json
   {
     "phone_number": "<normalized_phone>",
     "content": "<interpolated_message>",
     "quote_id": null
   }
   ```
3. Attach required headers:
   - `Content-Type: application/json`
   - `x-api-key: {WHATSAPP_API_KEY}`

### Step 2: HTTP Request Execution
1. Send asynchronous POST request to `{WHATSAPP_API_URL}/send` with a short timeout (maximum 10s).
2. Measure latency with high-resolution timer (`time.perf_counter()`).

### Step 3: Response Code Interpretation
1. **HTTP 202 Accepted:** Enqueue succeeded. Record `last_status = 'queued'`, extract `message_id` if present, record latency in `job_runs`, and STOP. Do NOT retry.
2. **HTTP 401 Unauthorized / 422 Unprocessable:** Terminal permanent error. Mark job with `status = 'error'`, record concise `last_error`, increment error metrics. Do NOT attempt automatic retries.
3. **Network Error / HTTP 5xx:** Transient error. If retry count $< 3$, schedule exponential backoff; otherwise, mark job `status = 'error'`.
4. If terminal failure occurs, trigger operator dead-letter alert if `WHATSAPP_ADMIN_NUMBER` is configured.

## 6. Fail-Stop & Escalation Protocol

- **Retry Limit:** If dispatcher tests fail 2 consecutive times with the same error, STOP execution immediately.
- **Escalation Payload:** Report MUST state:
  1. Identified root cause (e.g., contract mismatch, unexpected gateway response schema)
  2. Exact mock response and payload sent
  3. Raw pytest error output
- **Forbidden Action:** The agent MUST NOT attempt undocumented ad-hoc workarounds or bypass safety checks once the retry limit is reached.

## 7. Git & Environment Safety

- **Forbidden Git Commands:** NEVER run `git push --force`, `git reset --hard`, or `git clean -fd` without explicit human instruction.
- **Secret Protection:** NEVER expose `WHATSAPP_API_KEY` or real recipient telephone numbers in log messages or git commits.

## 8. Contrast Pairs

```python
// BAD: Prohibited field names, wrong auth header, polling loop
response = await client.post(
    f"{url}/send",
    headers={"Authorization": f"Bearer {token}"},
    json={"to": phone, "body": message}
)
while not check_delivered(response.json()["id"]):
    await asyncio.sleep(1)

// GOOD: Canonical contract, x-api-key header, 202 as definitive success
response = await client.post(
    f"{url}/send",
    headers={"x-api-key": api_key, "Content-Type": "application/json"},
    json={"phone_number": phone, "content": message, "quote_id": None}
)
if response.status_code == 202:
    return DispatchResult(status="queued", message_id=response.json().get("message_id"))
```

## 9. Verification Checklist

- [ ] Command `uv run pytest tests/test_dispatcher.py -v` exits with status code 0
- [ ] Payload uses strictly `phone_number`, `content`, and optional `quote_id`
- [ ] Authentication header uses `x-api-key`, never `Authorization: Bearer`
- [ ] HTTP `202 Accepted` is recorded as success without polling or immediate retry
- [ ] No recipient phone numbers, message bodies, or API keys placed in log stream fields
