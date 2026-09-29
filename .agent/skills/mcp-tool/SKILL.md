---
name: mcp-tool
description: Expose closed-surface stdio MCP tools communicating strictly over local HTTP, maintaining token density and zero direct SQLite queries.
---

# MCP Tool Development (`mcp-tool`)

Canonical specification for implementing and evolving stdio MCP tools within homelab-schedule.

## 1. Scope & Blast Radius

- **MUTABLE PATHS:** `src/homelab_schedule/mcp.py`, `tests/test_mcp*.py`, `.agent/CHANNELS.md`.
- **IMMUTABLE PATHS:** Direct SQLite database connection, `.cursor/mcp.json` (unversioned), gateway credentials.
- **FORBIDDEN ACTIONS:**
  - MUST NOT connect directly to the SQLite database file (`data/schedule.db`) from within the MCP process.
  - MUST NOT expand the tool surface into generic CRUD or unbounded `PATCH` operations.
  - MUST NOT leak raw gateway dispatch fields (`phone_number`, `quote_id`) into MCP tool parameter schemas.
  - MUST NOT emit multi-line pretty-printed JSON payloads in responses; enforce token-dense single-line JSON.

## 2. When to Use (Triggers)

The agent MUST activate this skill when:
- Creating, modifying, or deprecating tools exposed on the stdio MCP server (`homelab-schedule-mcp`).
- Updating JSON input schemas or return contracts for existing tools (`schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`, `pause`, `resume`, `snooze`, `preview`, `daily_digest`).
- Mapping MCP tool calls to internal FastAPI HTTP routes.

The agent MUST NOT activate this skill when:
- Interacting with MCP tools as a caller or user agent (activate `anotar-agenda`).
- Modifying FastAPI route handlers or schemas (activate `api-endpoint`).
- Altering the SQLite persistence schema (activate `database-migration`).

## 3. Required Tools & Prerequisites

- **Tools / MCPs:** `uv run pytest tests/test_mcp.py`.
- **Pre-Conditions:** Local HTTP server endpoint declared via `SCHEDULE_API_URL` (default `http://127.0.0.1:8003`) and `SCHEDULE_API_KEY`.

## 4. Conflict Resolution & Precedence

Precedence order when rules conflict:
1. Security, Credentials & Blast Radius (Zero direct DB access, no leaked API keys)
2. Falsifiable Invariants & Automated Verification (Strict closed tool surface per ADR-005, unit tests pass)
3. Task Specifications & Performance (Token density, compact list responses, error strings)
4. Style & Formatting Conventions (Consistent parameter naming, concise docstrings)

If an unresolvable rule conflict occurs, the agent MUST halt execution and request human clarification.

## 5. Operational Procedure

### Step 1: Closed Surface Boundary Assessment
1. Default assumption: do NOT create new tools. The tool surface is strictly closed per ADR-005:
   - `schedule`: Create agenda item
   - `preview`: Dry-run variable rendering and timestamp resolution
   - `list_agenda`: Query agenda with compact summaries
   - `get_item`: Fetch full details for a single job by id
   - `cancel`: Cancel a scheduled SQLite job
   - `reschedule`: Modify base recurrence or execution time
   - `pause` / `resume`: Suspend and re-activate recurring jobs
   - `snooze`: Temporarily postpone next run without mutating cron
   - `daily_digest`: Consolidate daily agenda and detect schedule conflicts / overlaps
2. Any addition beyond this set requires explicit architectural justification and ADR update.

### Step 2: Input Schema Definition
1. Use user-centric parameter names (`when`, `to`, `content`, `title`, `id`).
2. Support search filters in `list_agenda`: `status`, `limit` (max 50), `to`, `query`, `period`.
3. Prohibit direct dispatch parameters: do NOT accept `phone_number` or gateway secrets.

### Step 3: HTTP Bridge Implementation
1. The MCP process MUST act exclusively as an HTTP client communicating with `SCHEDULE_API_URL`.
2. Attach header `x-api-key: SCHEDULE_API_KEY` on all requests.
3. Handle network and service exceptions gracefully: if connection fails, return structured error: `{"error": "API homelab-schedule indisponível"}`. Do NOT raise unhandled Python tracebacks into stdio JSON-RPC.

### Step 4: Token Density Optimization
1. Return compact, single-line JSON representations.
2. In `list_agenda`, omit verbose message bodies (`content`), returning only metadata necessary for identification.
3. Validate tests:
   ```bash
   uv run pytest tests/test_mcp.py -v
   ```

## 6. Fail-Stop & Escalation Protocol

- **Retry Limit:** If MCP test execution fails 2 consecutive times with the same error, STOP execution immediately.
- **Escalation Payload:** Report MUST state:
  1. Identified root cause (e.g., schema validation failure, unexpected HTTP status code from bridge)
  2. Exact command executed and error output
  3. Current workspace git diff
- **Forbidden Action:** The agent MUST NOT attempt undocumented ad-hoc workarounds or bypass safety checks once the retry limit is reached.

## 7. Git & Environment Safety

- **Forbidden Git Commands:** NEVER run `git push --force`, `git reset --hard`, or `git clean -fd` without explicit human instruction.
- **Secret Protection:** NEVER commit editor profile configurations (`.cursor/mcp.json`) containing private API keys.

## 8. Contrast Pairs

```python
// BAD: Direct SQLite access from MCP process
@mcp.tool()
def cancel_job(id: str) -> str:
    db = sqlite3.connect("data/schedule.db")
    db.execute("DELETE FROM jobs WHERE id = ?", (id,))
    db.commit()
    return "Job deleted"

// GOOD: HTTP client bridge delegating to authenticated service API
@mcp.tool()
async def cancel(id: str) -> dict[str, str]:
    async with httpx.AsyncClient(base_url=settings.schedule_api_url) as client:
        res = await client.post(f"/jobs/{id}/cancel", headers={"x-api-key": settings.schedule_api_key})
        if res.status_code == 200:
            return {"status": "cancelled", "id": id}
        return {"error": res.json().get("detail", "Failed to cancel job")}
```

## 9. Verification Checklist

- [ ] Command `uv run pytest tests/test_mcp.py -v` exits with status code 0
- [ ] Tool adheres strictly to the closed surface defined in ADR-005
- [ ] MCP implementation contains zero SQLite connections or direct database queries
- [ ] List tool (`list_agenda`) limits output and omits full message content by default
- [ ] `.cursor/mcp.json` remains excluded from version control
