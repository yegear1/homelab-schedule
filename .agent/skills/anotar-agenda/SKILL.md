---
name: anotar-agenda
description: Annotate, list, cancel, snooze, or reschedule reminders via homelab-schedule MCP stdio tools, ensuring strict closed-surface compliance.
---

# Agenda Annotation via MCP (`anotar-agenda`)

Canonical specification for operating the closed-surface homelab-schedule MCP stdio server tools to manage agenda items.

## 1. Scope & Blast Radius

- **MUTABLE PATHS:** Agenda entries managed through MCP tools (`schedule`, `reschedule`, `snooze`, `pause`, `resume`, `cancel`).
- **IMMUTABLE PATHS:** Direct SQLite database files (`data/schedule.db`), `.cursor/mcp.json` (must not be committed), `.env`.
- **FORBIDDEN ACTIONS:**
  - MUST NOT execute ad-hoc curl commands or direct `POST /send` when MCP tools are available.
  - MUST NOT expose or invoke generic CRUD or arbitrary `PATCH` endpoints.
  - MUST NOT bypass HTTP service validation via direct database access.
  - MUST NOT attempt to mutate or cancel YAML routines (`source: yaml`) through SQLite MCP tools; instruct operator to edit `routines.yaml`.

## 2. When to Use (Triggers)

The agent MUST activate this skill when:
- Processing conversational requests to annotate or schedule reminders ("anota", "me lembra", "agenda", "marcar um recado").
- Querying active or historical agenda entries ("o que tem marcado", "o que tem na agenda", "listar lembretes").
- Rescheduling, postponing, or snoozing an existing reminder ("adia o recado", "remarca para mais tarde", "snooze").
- Pausing, resuming, or cancelling reminders ("desmarca", "cancela", "pausa").

The agent MUST NOT activate this skill when:
- Implementing or extending MCP server tool definitions (activate `mcp-tool`).
- Altering the underlying SQLite persistence schema (activate `database-migration`).
- Dispatching immediate messages without scheduling (activate `whatsapp-dispatch`).
- Editing permanent declarative routines (modify `routines.yaml` directly).

## 3. Required Tools & Prerequisites

- **Tools / MCPs:** `homelab-schedule` stdio MCP server exposing closed tool surface: `schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`, `pause`, `resume`, `snooze`, `preview`.
- **Pre-Conditions:** Local HTTP API service must be active (`uv run uvicorn homelab_schedule.main:create_app --factory --port 8003`); valid `SCHEDULE_API_KEY` configured.

## 4. Conflict Resolution & Precedence

Precedence order when rules conflict:
1. Security, Credentials & Blast Radius (Closed MCP surface, zero unscrubbed keys, zero direct SQL)
2. Falsifiable Invariants & Automated Verification (Strict tool input schemas, deterministic datetime parsing)
3. Task Specifications & Performance (Compact list responses without message body dumps)
4. Style & Formatting Conventions (Confirmation response format in BRT and UTC)

If an unresolvable rule conflict occurs, the agent MUST halt execution and request human clarification.

## 5. Operational Procedure

### Step 1: Tool Selection
1. Map user intent to the appropriate closed MCP tool:
   - Create reminder: `schedule(when, content, to, title, until?, max_runs?, variables?)`
   - Dry-run validation: `preview(when, content, to, title?, variables?)`
   - Query agenda: `list_agenda(status?, limit?, to?, query?, period?)`
   - Inspect single job: `get_item(id)`
   - Postpone immediate run: `snooze(id, duration_minutes?, until?, when?)`
   - Re-schedule base rule: `reschedule(id, when)`
   - Suspend/Resume: `pause(id)` / `resume(id)`
   - Cancel reminder: `cancel(id)`
2. For permanent policies, instruct operator to edit `routines.yaml` with a stable identifier.

### Step 2: Parameter Resolution
1. Resolve `when`: Accept ISO-8601, 5-field cron, relative intervals (`+15m`, `2h`, `em 10 minutos`), or natural Portuguese datetime expressions (`amanhã 14h`, `hoje 18:00`, `segunda 9h`). Default timezone: `America/Sao_Paulo`.
2. Resolve `to`: Default to `eu` unless a registered contact or alias is specified. Do NOT ask for raw phone number if alias is known.
3. If parameters remain ambiguous, ask exactly one clarifying question before executing.

### Step 3: Tool Execution & Operator Confirmation
1. Invoke the target MCP tool.
2. If tool returns `API homelab-schedule indisponível`, verify API server status; do NOT fabricate fake IDs or mock persistence.
3. Return operator confirmation containing:
   - Assigned job `id`
   - Scheduled local time (`America/Sao_Paulo` / BRT) and UTC timestamp
   - Recipient `to`
   - Title and content preview

## 6. Fail-Stop & Escalation Protocol

- **Retry Limit:** If tool invocation fails 2 consecutive times with the same error, STOP execution immediately.
- **Escalation Payload:** Report MUST state:
  1. Identified root cause (e.g., HTTP 401 Unauthorized, HTTP 409 YamlJobImmutable, API connection refused)
  2. Exact tool call and arguments
  3. Raw error string returned by MCP server
- **Forbidden Action:** The agent MUST NOT attempt undocumented ad-hoc workarounds or bypass safety checks once the retry limit is reached.

## 7. Git & Environment Safety

- **Forbidden Git Commands:** NEVER run `git push --force`, `git reset --hard`, or `git clean -fd` without explicit human instruction.
- **Secret Protection:** NEVER expose `SCHEDULE_API_KEY` or credentials in tool calls, logs, or chat messages.

## 8. Contrast Pairs

```json
// BAD: Arbitrary PATCH request attempting direct status mutation
{
  "method": "PATCH",
  "path": "/jobs/job-123",
  "body": { "status": "snoozed", "next_run_at": "2026-09-12T16:00:00Z" }
}

// GOOD: Closed-surface MCP tool call
{
  "tool": "snooze",
  "arguments": {
    "id": "job-123",
    "duration_minutes": 120
  }
}
```

## 9. Verification Checklist

- [ ] Command `uv run pytest tests/test_mcp.py` exits with status code 0
- [ ] Tool call utilizes only operations from the closed MCP surface (ADR-005)
- [ ] Response confirmation presents job ID, BRT time, UTC time, target, and content
- [ ] No raw database queries or direct `POST /send` executed
- [ ] Zero API keys or tokens leaked in conversation output
