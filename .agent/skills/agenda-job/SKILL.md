---
name: agenda-job
description: Extract agenda job fields (when, content, to, title), enforce America/Sao_Paulo timezone, validate dry-run previews, and mandate operator confirmation.
---

# Agenda Job Specification (`agenda-job`)

Canonical specification for extracting, validating, and persisting agenda jobs in homelab-schedule.

## 1. Scope & Blast Radius

- **MUTABLE PATHS:** Job records via MCP stdio tools or HTTP endpoints (`POST /jobs`, `routines.yaml`).
- **IMMUTABLE PATHS:** Direct SQLite database files (`data/schedule.db`), `.env`, secret configurations.
- **FORBIDDEN ACTIONS:**
  - MUST NOT execute `POST /send` directly to test or mock reminder delivery.
  - MUST NOT inject experimental `* * * * *` minute crontab expressions into production schedules.
  - MUST NOT persist a job if temporal expression (`when`) is ambiguous; ask exactly one clarifying question.
  - MUST NOT pass dispatch gateway payload structures (`phone_number`, `quote_id`) to MCP schedule tools.

## 2. When to Use (Triggers)

The agent MUST activate this skill when:
- Processing user requests to schedule, remind, inspect, or cancel an agenda item ("anota", "me lembra", "agenda", "o que tem marcado", "cancela").
- Creating or updating job persistence logic in HTTP routes, YAML routine loaders, or MCP tools.
- Calculating next run timestamps and dry-running message variable substitutions before persistence.

The agent MUST NOT activate this skill when:
- Dispatching due messages through the external gateway (activate `whatsapp-dispatch`).
- Operating MCP stdio client pens directly within editor workflows (activate `anotar-agenda`).
- Recording defects or deferred bugs (activate `github-bug-issue`).

## 3. Required Tools & Prerequisites

- **Tools / MCPs:** `homelab-schedule` MCP tools (`schedule`, `preview`, `list_agenda`, `get_item`, `cancel`, `reschedule`), or local HTTP API with `x-api-key`.
- **Pre-Conditions:** Target channel identified (ephemeral ad-hoc schedule vs permanent `routines.yaml`); default timezone set to `America/Sao_Paulo`.

## 4. Conflict Resolution & Precedence

Precedence order when rules conflict:
1. Security, Credentials & Blast Radius (Zero direct `/send`, zero unscrubbed credentials)
2. Falsifiable Invariants & Automated Verification (Exact field extraction, ISO-8601/cron format)
3. Task Specifications & Performance (YAML vs SQLite persistence boundary)
4. Style & Formatting Conventions (Message preview and operator confirmation format)

If an unresolvable rule conflict occurs, the agent MUST halt execution and request human clarification.

## 5. Operational Procedure

### Step 1: Pre-Flight Field Extraction
1. Extract the four canonical job fields:
   - `when`: One-off (ISO-8601 with offset, relative delta `+15m`/`2h`/`em 10 minutos`, or friendly timestamp `amanhã 14h`/`hoje 18:00`) or recurring (5-field cron). Default timezone is `America/Sao_Paulo` (`APP_TZ`).
   - `content`: Exact textual message body.
   - `to`: Target alias or normalized recipient identifier. Default: `eu`. Do NOT prompt for raw phone number if alias exists.
   - `title`: Short one-line summary (derive concisely from `content` if not provided).
2. If `when` is ambiguous, halt persistence and ask exactly one clarifying question.
3. Validate dry-run execution with `preview` tool or `POST /jobs/preview` to verify recipient resolution and variable expansion (`{{name}}`, `{{date}}`, `{{time}}`).

### Step 2: Channel Selection & Persistence
1. Select persistence target:
   - One-off reminders or ad-hoc crons: invoke MCP `schedule` or `POST /jobs`.
   - Permanent recurring policies (e.g., daily backups, weekly system audits): declare in `routines.yaml` with a stable `id`. NEVER insert permanent policies directly into SQLite.
2. If job requires recurrence expiration, set `until` (ISO-8601 UTC) or `max_runs` (integer cap).

### Step 3: Mandatory Confirmation Payload
1. Return confirmation containing:
   - Job `id`
   - Next run timestamp in local BRT (`America/Sao_Paulo`) and UTC
   - Recipient `to`
   - Resolved `title` and `content`
2. Mark task incomplete until operator confirmation payload is emitted.

## 6. Fail-Stop & Escalation Protocol

- **Retry Limit:** If scheduling or validation fails 2 consecutive times with the same error, STOP execution immediately.
- **Escalation Payload:** Report MUST state:
  1. Identified root cause (e.g., unresolved alias, malformed cron expression, API unavailable)
  2. Exact payload passed to `schedule` or `POST /jobs`
  3. Current API status and error response
- **Forbidden Action:** The agent MUST NOT attempt undocumented ad-hoc workarounds or bypass safety checks once the retry limit is reached.

## 7. Git & Environment Safety

- **Forbidden Git Commands:** NEVER run `git push --force`, `git reset --hard`, or `git clean -fd` without explicit human instruction.
- **Secret Protection:** NEVER expose `SCHEDULE_API_KEY` or `WHATSAPP_API_KEY` in tool inputs, chat confirmations, or logged exceptions.

## 8. Contrast Pairs

```json
// BAD: Direct gateway payload used to test a reminder
{
  "phone_number": "5511999999999",
  "content": "Pagar condomínio",
  "quote_id": null
}

// GOOD: Strictly typed agenda job specification for MCP schedule tool
{
  "when": "2026-09-12T14:00:00-03:00",
  "to": "eu",
  "title": "condomínio",
  "content": "Pagar condomínio."
}
```

## 9. Verification Checklist

- [ ] Command `uv run pytest tests/test_jobs.py` exits with status code 0
- [ ] All four fields (`when`, `content`, `to`, `title`) resolved deterministically
- [ ] Recurrence rules use strict 5-field cron or valid ISO-8601 timestamps
- [ ] Confirmation output includes job `id`, local BRT time, UTC time, target, and content
- [ ] Zero direct calls to `POST /send` during scheduling workflow
- [ ] No API keys or recipient tokens exposed in task output
