---
name: due-tick
description: Operate the asyncio tick loop querying next_run_at in UTC, waking on notebook_changed events, with 300s sleep caps and zero APScheduler.
---

# Scheduler Due Tick (`due-tick`)

Canonical specification for the asyncio event-driven due-tick execution loop in homelab-schedule.

## 1. Scope & Blast Radius

- **MUTABLE PATHS:** `src/homelab_schedule/scheduler.py`, `src/homelab_schedule/tick.py`, `tests/test_scheduler*.py`.
- **IMMUTABLE PATHS:** Database migration definitions (`src/db/**`), `.env`, secret configurations.
- **FORBIDDEN ACTIONS:**
  - MUST NOT introduce APScheduler, Celery, CronTab daemons, or separate background worker processes.
  - MUST NOT store `next_run_at` in local timezone without converting to ISO-8601 UTC.
  - MUST NOT replay historical missed executions for overdue cron jobs; coalesce into a single execution.
  - MUST NOT execute a zero-delay busy loop; cap sleep intervals between 0 and 300 seconds.
  - MUST NOT mutate a future one-off (`once`) job's scheduled time when executing an on-demand manual run (`run_now`).

## 2. When to Use (Triggers)

The agent MUST activate this skill when:
- Modifying the scheduler execution loop or event notification machinery.
- Calculating `next_run_at` for one-off timestamps or 5-field cron patterns in `America/Sao_Paulo`.
- Implementing catch-up logic when recovering from container suspension or network downtime.
- Wiring `asyncio.Event` (`notebook_changed`) to trigger immediate wake-ups on job creation or modification.

The agent MUST NOT activate this skill when:
- Executing the HTTP dispatch call to the gateway (activate `whatsapp-dispatch`).
- Creating jobs via MCP tools (activate `anotar-agenda`).
- Modifying SQLite table schema (activate `database-migration`).

## 3. Required Tools & Prerequisites

- **Tools / MCPs:** `uv run pytest tests/test_scheduler.py`.
- **Pre-Conditions:** Injectable mock clock (`now` fixture) and mock HTTP transport for dispatcher tests.

## 4. Conflict Resolution & Precedence

Precedence order when rules conflict:
1. Security, Credentials & Blast Radius (No unscrubbed credentials or raw payload logs)
2. Falsifiable Invariants & Automated Verification (Single-run cron coalesce, UTC next_run_at, 202 handling)
3. Task Specifications & Performance (Single process coroutine, event-driven wakeups, max 300s delay)
4. Style & Formatting Conventions (Structured exception handling, explicit logging)

If an unresolvable rule conflict occurs, the agent MUST halt execution and request human clarification.

## 5. Operational Procedure

### Step 1: Timestamp Normalization
1. On job creation or update, compute `next_run_at` strictly in UTC:
   - One-off (`once`): set `next_run_at = run_at` (converted to UTC).
   - Recurring (`cron`): compute next wall-clock occurrence in `America/Sao_Paulo` strictly greater than `now()`, then convert to UTC.
2. Store `next_run_at` as ISO-8601 UTC text (`YYYY-MM-DDTHH:MM:SSZ` or `+00:00`).

### Step 2: Tick Loop Execution
1. Query due jobs: `SELECT * FROM jobs WHERE status = 'scheduled' AND enabled = 1 AND next_run_at <= :now_utc ORDER BY next_run_at ASC`.
2. Dispatch each due job sequentially using `whatsapp-dispatch`.
3. Process dispatch outcome:
   - On `202 Accepted`: increment `run_count`; if one-off or `until`/`max_runs` limit reached, mark `status = 'done'`, `enabled = 0`, `next_run_at = NULL`. If recurring, calculate next occurrence in the future.
   - On terminal error (`401`/`422` or retry limit reached): mark `status = 'error'`, `enabled = 0`, record `last_error`.
4. Calculate delay: `delay = min(max(0, (next_run_at - now_utc).total_seconds()), 300)`.
5. Sleep until delay expires or wake event signals:
   ```python
   try:
       await asyncio.wait_for(notebook_changed.wait(), timeout=delay)
   except TimeoutError:
       pass
   notebook_changed.clear()
   ```

### Step 3: Catch-Up & Coalescing Rules
1. If a one-off job is overdue: fire once, record outcome, mark `status = 'done'`.
2. If a recurring cron job is overdue (e.g. host slept for days): fire exactly ONCE; advance `next_run_at` to the next occurrence in the future relative to `now()`. Do NOT generate a backlog cascade.

## 6. Fail-Stop & Escalation Protocol

- **Retry Limit:** If scheduler tests fail 2 consecutive times with the same error, STOP execution immediately.
- **Escalation Payload:** Report MUST state:
  1. Identified root cause (e.g., timezone offset bug, infinite loop, missing event trigger)
  2. Exact test command and failure log
  3. Current scheduler state and git diff
- **Forbidden Action:** The agent MUST NOT attempt undocumented ad-hoc workarounds or bypass safety checks once the retry limit is reached.

## 7. Git & Environment Safety

- **Forbidden Git Commands:** NEVER run `git push --force`, `git reset --hard`, or `git clean -fd` without explicit human instruction.
- **Secret Protection:** NEVER print or log recipient phone numbers, message contents, or API keys in scheduler logs.

## 8. Contrast Pairs

```python
// BAD: Replaying multiple missed cron intervals after system downtime
while next_run_at <= now_utc:
    await dispatch(job)
    next_run_at = compute_next_cron(job.cron_expr, next_run_at)

// GOOD: Single coalesced execution with next run scheduled in the future
await dispatch(job)
job.next_run_at = compute_next_future_cron(job.cron_expr, now_utc, tz="America/Sao_Paulo")
```

## 9. Verification Checklist

- [ ] Command `uv run pytest tests/test_scheduler.py -v` exits with status code 0
- [ ] Due query uses indexed columns `(status, enabled, next_run_at)`
- [ ] Immediate job creation triggers `notebook_changed.set()` without waiting for timeout cap
- [ ] Catch-up coalescing verified: multiple missed intervals result in exactly one dispatch
- [ ] Zero external scheduler frameworks (APScheduler, Celery) imported
