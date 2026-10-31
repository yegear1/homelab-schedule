# [ADR-005] Closed Surface MCP Server

- **Status:** Approved
- **Date:** 2026-09-11
- **Updated:** 2026-09-12 (Added `reschedule`), 2026-09-19 (Added `preview` for dry-run), 2026-09-20 (Added `pause`, `resume`, `snooze` for lifecycle), 2026-09-29 (Added `daily_digest` for morning synthesis and conflict detection), 2026-10-04 (Added `upcoming_runs` for timeline projection)
- **Author(s):** yegear / design session

---

## 1. Problem Context

Language models frequently hallucinate non-standard crontab patterns and unconstrained REST `PATCH` mutations. The agenda MCP server requires a compact, closed tool surface with token-dense responses to prevent context bloat and hallucinated mutations.

## 2. Decision Taken

Implement a **stdio-based** Python MCP server communicating strictly with the local HTTP daemon (`localhost:8003`), never accessing SQLite files directly.

Exposed MCP Tools:
1. `schedule`: Create one-off or recurring reminders.
2. `list_agenda`: List upcoming and pending items with compact summaries.
3. `get_item`: Inspect a specific job by ID.
4. `cancel`: Cancel a job by ID (SQLite jobs only; YAML routines return conflict error).
5. `pause`: Temporarily disable a SQLite job without deletion.
6. `resume`: Re-enable a paused SQLite job.
7. `snooze`: Postpone next run timestamp without altering base recurrence pattern.
8. `reschedule`: Move a one-off job to a new execution timestamp.
9. `preview`: Side-effect-free dry-run testing temporal parsing, recipient resolution, and dynamic template variable interpolation.
10. `daily_digest`: Morning/daily agenda consolidation detecting time overlaps for identical recipients.
11. `upcoming_runs`: Deterministic projection of future occurrences in UTC and local timezone respecting lifecycle bounds (`until`, `max_runs`).

Forbidden: Generic REST `PATCH`, generic SQL queries, and full CRUD endpoints for contacts/templates over MCP.
`list_agenda` returns compact summaries and omits full message content bodies. Direct production database mutations via MCP require human operator consent per `AGENTS.md`.

## 3. Alternatives Considered

- **Expose entire OpenAPI schema as MCP tools:** Results in hallucinated schema parameters and accidental mutations to declarative YAML routines.
- **Direct SQLite database MCP:** Violates layered architecture, bypasses validation logic, and bypasses event notifications.

## 4. Consequences and Trade-offs

### Positive

- Minimal token consumption; the `agenda-job` skill fits on a single page.
- HTTP API remains fully testable via pytest independently of MCP runtime.

### Negative / Accepted Risks

- Contact and template catalog management remains restricted to Web UI and HTTP API.
- MCP fails if the HTTP server is down; returns structured error referencing URL without exposing secret keys.

## 5. References and Links

- `.agent/skills/mcp-tool/SKILL.md`
- `.agent/CHANNELS.md`
- `AGENTS.md` (MCP Guidelines)
