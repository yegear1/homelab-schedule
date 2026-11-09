# Architecture Decision Records — homelab-schedule

Consolidated chronological log of architectural decisions for homelab-schedule.

---

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

Dispatch clock reference: [ADR-006](#adr-006-temporal-dispatch-next_run_at-utc-index-and-asyncio-tick-loop).

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
- [ADR-006: Dispatch Clock](#adr-006-temporal-dispatch-next_run_at-utc-index-and-asyncio-tick-loop)

---

# [ADR-002] SQLite WAL for Reminders and YAML for Permanent Routines

- **Status:** Approved
- **Date:** 2026-09-11
- **Author(s):** yegear / design session

---

## 1. Problem Context

The homelab scheduler manages two distinct classes of records: ephemeral/dynamic reminders ("tomorrow 2 PM: pay condo fee") and declarative permanent operational policies ("every Monday: backup status check"). Storing everything in SQLite obscures git history for infrastructure policies. Storing everything in YAML prevents MCP AI agents and dynamic API callers from securely recording one-off items without committing to git on every reminder.

## 2. Decision Taken

Segregate persistence into dual sources:

- **SQLite 3 WAL** (`DATABASE_PATH` on persistent volume): Stores dynamic jobs created via MCP or HTTP API (`source='sqlite'`).
- **`routines.yaml`** (`ROUTINES_PATH` mounted from repository or host): Stores declarative routines with stable string IDs; merged on application startup (`source='yaml'`).
- Schema management: Applied via versioned Python connection hooks on connect (`PRAGMA user_version`), without Alembic. One-off jobs (`schedule_type='once'`) transition to `status='done'` upon successful HTTP dispatch; recurring cron jobs update `next_run_at` to the next future timestamp.

## 3. Alternatives Considered

- **SQLite only:** Operational homelab routines disappear from git version control and cannot survive volume loss without database restores.
- **YAML only:** AI agent lacks a safe concurrency mechanism to record spontaneous reminders without committing git diffs continuously.
- **PostgreSQL:** Excessive memory and operational overhead for a local Mini PC with a single writer process.

## 4. Consequences and Trade-offs

### Positive

- Ephemeral reminders and permanent policies follow appropriate distinct lifecycles.
- Backup strategy is modular: volume snapshots for SQLite dynamic state, git commits for YAML routines.

### Negative / Accepted Risks

- YAML merge requires unique, stable IDs; ID collisions between SQLite and YAML must be rejected with HTTP 409.
- Runtime file watching: Relies on `st_mtime` tracking during tick loop plus explicit `POST /routines/reload` webhook trigger.
- HTTP cancellation of YAML-sourced jobs returns `409 Conflict` (requires direct editing of `routines.yaml`).

## 5. References and Links

- `.agent/CHANNELS.md`
- `.agent/skills/database-migration/SKILL.md`

---

# [ADR-003] Three In-Repo Pens, Single Shared Notebook

- **Status:** Approved (Sanitized 2026-09-12 for public release)
- **Date:** 2026-09-11
- **Author(s):** yegear / design session

---

## 1. Problem Context

Users require multiple input surfaces (AI agent prompt, automation script, declarative git routine) to record reminders without incurring dependencies on external calendar servers, email inboxes, or heavy cloud platforms. Without clear boundaries, each input channel risks expanding into a separate standalone product.

## 2. Decision Taken

Restrict in-repo input interfaces ("pens") to:

1. **MCP (Model Context Protocol):** AI agent stdio pen.
2. **HTTP API:** Machine automation pen and backend target for the MCP server.
3. **YAML (`routines.yaml`):** Declarative infrastructure routine pen.

Explicitly out of scope in this repository: CalDAV, IMAP/SMTP email polling, Telegram bots, WhatsApp socket listeners, or GitHub issues as reminder queues. The operator Web UI was later incorporated into the repository per [ADR-007](#adr-007-operator-web-ui-in-same-repository-web-and-proto). External chat bots or messaging services interact strictly as external **HTTP callers** (`POST /jobs`). Messaging client protocol code does not reside here.

Destination addressing supports aliases (e.g., `eu`) resolved via `WHATSAPP_ALIASES` (historical env name) with fallback default `to='eu'`.

## 3. Alternatives Considered

- **MCP only:** Unusable from curl, shell scripts, cron jobs, and non-LLM automations.
- **Embedded messaging client in container:** Would duplicate session state, authentication keys, outbound queues, and anti-ban safeguards. The scheduler strictly manages schedule state and issues outbound HTTP `POST /send`.
- **Google Calendar / CalDAV sync:** Involves complex OAuth flows and remote polling; conflicts with local homelab isolation.

## 4. Consequences and Trade-offs

### Positive

- Unified internal job model; three versioned ingestion surfaces within the repository.
- Future integrations act as downstream HTTP API clients rather than competing scheduler instances.

### Negative / Accepted Risks

- Scheduling from mobile devices requires an external caller (e.g., external webhook bot).
- Dual API key management: `SCHEDULE_API_KEY` (secures this API) vs `WHATSAPP_API_KEY` (authenticates outbound dispatch to the gateway).

## 5. References and Links

- `.agent/CHANNELS.md`
- `.agent/skills/whatsapp-dispatch/SKILL.md`
- [ADR-007: Web UI in Repo](#adr-007-operator-web-ui-in-same-repository-web-and-proto)

---

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

---

# [ADR-005] Closed Surface MCP Server

- **Status:** Approved
- **Date:** 2026-09-11
- **Updated:** 2026-09-12 (Added `reschedule`), 2026-09-19 (Added `preview` for dry-run), 2026-09-20 (Added `pause`, `resume`, `snooze` for lifecycle), 2026-09-29 (Added `daily_digest` for morning synthesis and conflict detection), 2026-10-04 (Added `upcoming_runs` for timeline projection), 2026-10-31 (Added `health_metrics` for operational aggregates)
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
12. `health_metrics`: Read-only aggregate job state and retained execution attempts over a bounded 1–168 hour window, without exposing recipients or content.

The explicit `health_metrics` addition avoids reconstructing operational totals from truncated agenda/history lists. It uses the authenticated HTTP boundary and exposes no arbitrary queries or mutation capabilities. Its status describes stored agenda/history, not scheduler or gateway availability.

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

---

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
- [ADR-001: Python Monolith](#adr-001-python-monolith-fastapi--sqlite-tick-uv-python-313)

---

# [ADR-007] Operator Web UI in Same Repository (`web/` and `proto/`)

- **Status:** Approved
- **Date:** 2026-09-12
- **Author(s):** yegear / design session

---

## 1. Problem Context

The contacts, templates, and jobs endpoints exist and the interface contract [INTERFACE.md](../../.agent/INTERFACE.md) is approved. Stitch design prototypes exist in `proto/scr-*/code.html`. The repository requires a dedicated location for the web application without polluting `src/homelab_schedule/` and without spinning up a separate runtime container.

## 2. Decision Taken

Incorporate the frontend directly within the repository structure:

- **`proto/`:** Preserved visual design source (Stitch HTML/Tailwind prototypes). Kept intact for reference; never deleted during porting.
- **`web/`:** Single Page Application (SPA) built with Svelte 5 and Vite. Component hierarchy: `web/src/layout/`, `web/src/components/`, `web/src/pages/`.
- **Frontend Stack:** Svelte 5 (Runes), Tailwind CSS (tokens derived from Stitch and Apple HIG design systems). Prohibit React or Vue.
- **Production Runtime:** Served by the existing FastAPI process via `StaticFiles` mounted from `web/dist/`. Authenticated with operator `x-api-key`.
- In-repo pens remain: MCP, HTTP, and YAML are maintained alongside Web UI as the fourth input surface.

This explicitly amends the earlier "no UI in repo" constraint from [ADR-003](#adr-003-three-in-repo-pens-single-shared-notebook) specifically for the local human operator Web UI. CalDAV, IMAP email, and messaging clients remain strictly out of scope.

## 3. Alternatives Considered

- **Separate frontend repository:** Causes duplicated interface contracts and violates single-container homelab deployment simplicity.
- **Directly serving static HTML from `proto/`:** Fails to provide reactive state bindings, dynamic API synchronization, or type safety.
- **Embedding Svelte source inside `src/homelab_schedule/`:** Conflates Python packaging tooling with Node.js frontend build systems.

## 4. Consequences and Trade-offs

### Positive

- Porting follows the `ui-port` and `component-contract` skills with predictable component layout.
- Prototypes in `proto/` remain accessible side-by-side for visual regression auditing.

### Negative / Accepted Risks

- Production Docker multi-stage build requires an intermediate Node.js build stage.
- Directory artifacts `node_modules/` and `web/dist/` must remain untracked in `.gitignore`.

## 5. References and Links

- `.agent/INTERFACE.md`
- [ADR-003: Three In-Repo Pens](#adr-003-three-in-repo-pens-single-shared-notebook)
- `proto/scr-*/code.html`
