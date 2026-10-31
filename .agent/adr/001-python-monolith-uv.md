# [ADR-001] Python Monolith: FastAPI + SQLite Tick, UV, Python 3.13

- **Status:** Approved
- **Date:** 2026-09-11
- **Author(s):** yegear / design session

---

## 1. Problem Context

Homelab agenda in a single container: dispatching HTTP POST requests to an outbound gateway, handling one-off reminders and recurring cron jobs without Celery, Redis, n8n, or extra message queues. The Python homelab stack already standardizes on UV and Python 3.13+. Primary objective: simplicity and lightweight idle resource footprint on a Mini PC.

## 2. Decision Taken

Deploy a **single OS process**: FastAPI (HTTP API and web static files) + **asyncio tick** (background scheduled dispatch) + sqlite3 in WAL mode. Standardize strictly on **UV** package manager and Python **3.13+**. Prohibit Redis, **prohibit APScheduler**, **prohibit Alembic**, and **prohibit Loguru** (use standard library `logging` with NDJSON format).
Schema migrations execute via versioned SQLite PRAGMA checks on connect (`CREATE TABLE IF NOT EXISTS` with `PRAGMA user_version`).
Production container: `python:3.13-slim`, single uvicorn worker, with dev/test dependencies omitted from the runtime image.

Dispatch clock reference: [ADR-006](006-tick-next-run.md).

## 3. Alternatives Considered

- **APScheduler:** In-memory secondary source of truth; complex synchronization with cancellations and external YAML edits.
- **Alembic:** Unnecessary operational overhead for single-service, append-only SQLite schema.
- **Host crontab / Ofelia:** Poor ergonomics for dynamic one-off reminders and MCP agent tool execution.
- **Celery Beat / multi-container:** High RAM footprint and concurrent multi-writer SQLite lock contention.

## 4. Consequences and Trade-offs

### Positive

- Low memory footprint: ~40–80 MB idle RAM; ~0% CPU utilization between ticks.
- Single source of truth: `next_run_at` persisted in SQLite.

### Negative / Accepted Risks

- Container downtime halts dispatch: jobs are delayed until container recovers (catch-up handled per ADR-006).
- Schema evolution requires in-code versioned migrations (`PRAGMA user_version`) rather than auto-generated migration scripts.

## 5. References and Links

- [UV Package Manager](https://docs.astral.sh/uv/)
- [ADR-006: Dispatch Clock](006-tick-next-run.md)
