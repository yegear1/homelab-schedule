# [ADR-006] Temporal Dispatch: `next_run_at` UTC Index and Asyncio Tick Loop

- **Status:** Approved
- **Date:** 2026-09-11
- **Author(s):** yegear / design session

---

## 1. Problem Context

Without third-party schedulers such as APScheduler, the system requires an efficient background dispatch loop that remains idle until the next scheduled job is due, wakes up immediately if a new near-term reminder is created via HTTP/MCP, and avoids busy-waiting polling.

## 2. Decision Taken

Each job persists an indexed **`next_run_at` in UTC**. The tick loop functions as an event-driven timer rather than a polling cron daemon:

```text
loop:
  1. SELECT jobs WHERE enabled AND status='scheduled' AND next_run_at <= now()
  2. For each due job, issue HTTP POST /send:
       If 202 Accepted:
         once  -> status='done', next_run_at=NULL
         cron  -> next_run_at = next calculated occurrence STRICTLY > now() (TZ: America/Sao_Paulo)
  3. t = MIN(next_run_at) among all enabled scheduled jobs
  4. await asyncio.wait_for(notebook_changed_event.wait(), timeout=min(t - now(), 300s))
```

Key Architectural Invariants:
- **Notebook Changed Event:** Mutations via `POST /jobs`, job cancellations, manual run-now triggers, and YAML reloads trigger an internal `asyncio.Event`. A reminder scheduled for +90 seconds wakes the loop immediately without waiting for the 300s timeout cap.
- **300-Second Sleep Cap:** Protects against clock skew, host NTP synchronizations, and edge-case timezone transitions.
- **Job Creation Semantics:**
  - `once`: Persists `next_run_at = run_at` converted to UTC (resolving naive ISO strings with default `TZ`).
  - `cron`: Evaluates five-field cron expressions against `America/Sao_Paulo` and persists the next future occurrence in UTC.
- **Downtime Catch-up:**
  - Overdue `once` jobs: Dispatched once upon startup/tick recovery.
  - Overdue `cron` jobs with missed iterations: Coalesced and dispatched exactly once, advancing immediately to the next future occurrence without bursting historical missed runs.
- **Run Now Semantics:** Dispatches immediately via outbound gateway without mutating the future `next_run_at` of scheduled one-off jobs.

## 3. Alternatives Considered

- **Fixed 30-second polling sleep:** Simpler, but introduces average 15-second dispatch latency and causes continuous disk/CPU wakeups.
- **APScheduler in-memory job store:** Rejected per ADR-001.
- **Host systemd timers:** Couples scheduling logic with host OS and breaks container portability.

## 4. Consequences and Trade-offs

### Positive

- Zero CPU utilization during idle periods (event loop sleep).
- Clean separation of concerns: HTTP API and MCP only mutate database records; the tick loop is the sole dispatcher.

### Negative / Accepted Risks

- Omitting `notebook_changed_event.set()` on write paths causes dispatch delays up to 300 seconds. Automated tests verify immediate wake-up for +2s jobs.
- Cron DST transitions: Evaluated using Python `zoneinfo`; database always stores unambiguous UTC timestamps.

## 5. References and Links

- `.agent/ENDPOINTS.md`
- `.agent/skills/due-tick/SKILL.md`
- [ADR-001: Python Monolith](001-monolito-python-uv.md)
