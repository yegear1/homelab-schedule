# NOTES.md — Active Contracts, Decisions, and Runtime Memory

> The WHY. The WHAT lives in `git log` and `TASK.md`. Record entries here only to explain architectural decisions, runtime invariants, active contracts, and traps.

---

## Vision

```text
MCP / HTTP / YAML / Web UI (In-repo pens, single container)
        → Shared Notebook (SQLite WAL + routines.yaml)
            → Background Tick: next_run_at UTC index + asyncio.Event
                → POST {WHATSAPP_API_URL}/send  →  202 Accepted (queued)
```

Single OS process. Zero Redis, zero APScheduler, zero Alembic, zero messaging client sockets in this repository.

---

## Formal ADRs

| ADR | Title | Status | Date |
|---|---|---|---|
| [ADR-001](adr/001-monolito-python-uv.md) | Single Process FastAPI + SQLite Tick, UV, Python 3.13 | Approved | 2026-09-11 |
| [ADR-002](adr/002-sqlite-e-yaml.md) | SQLite WAL for Reminders and YAML for Permanent Routines | Approved | 2026-09-11 |
| [ADR-003](adr/003-canetas.md) | Three In-Repo Pens, Single Shared Notebook | Approved | 2026-09-11 |
| [ADR-004](adr/004-dispatch-gatekeeper.md) | Dispatch Exclusively via POST /send on Configured HTTP Gateway | Approved | 2026-09-11 |
| [ADR-005](adr/005-mcp-superficie-fechada.md) | Closed Surface MCP Server | Approved | 2026-09-11 |
| [ADR-006](adr/006-tick-next-run.md) | Temporal Dispatch: `next_run_at` UTC Index and Asyncio Tick Loop | Approved | 2026-09-11 |
| [ADR-007](adr/007-ui-mesmo-repo.md) | Operator Web UI in Same Repository (`web/` and `proto/`) | Approved | 2026-09-12 |

---

## Architectural Decisions Beyond ADRs

### [2026-10-31] Semantic Tokens and Shell Motion

- Theme palette uses space-separated RGB channels for background, label, separator, and fill tokens. Legacy `--color-*` variables alias these semantic tokens, preventing breakage in existing page styles during gradual visual migration.
- AppShell enforces 100 ms press duration and 280 ms selection duration with `cubic-bezier(0.16, 1, 0.3, 1)`. `prefers-reduced-motion` zeroes these durations and removes active scaling. The segmented control uses native `<button>` elements with `aria-pressed`, existing IDs, and localStorage persistence across light/dark/system themes.
- Theme tests resolve CSS aliases and assert minimum 4.5:1 WCAG contrast ratio between label and surface tokens across both light and dark themes.

### [2026-10-25] Shared Site Icon Between Header and Favicon

- The calendar-clock branding uses a single SVG at `web/src/assets/scheduler.svg`, shared across HTML `<link rel="icon">` and the Svelte `AppShell`. Vite bundles the versioned asset under `/assets`, served automatically by FastAPI static mount. Navy background and cyan accents preserve high contrast on both light and dark themes; header branding icon is marked `aria-hidden="true"` as the product title is adjacent.

### [2026-10-04] Upcoming Runs Projection (API, MCP, Web UI, Task [02.14])

- **Context:** Operators and AI agents required forward-looking projection of recurring (`kind="cron"`) job occurrences in local time (`America/Sao_Paulo`) and UTC, respecting lifecycle boundaries (`until`, `max_runs`, `run_count`) and active snooze overrides.
- **Decision:**
  - **Deterministic Cron Projection (`cron.py`):** Added `upcoming_cron_runs_utc(expr, after, limit, tz, until)` to project subsequent cron runtimes deterministically without mutating stored state.
  - **Endpoint `GET /jobs/{id}/upcoming`:** Authenticated endpoint (`x-api-key`) returning `UpcomingRunsResponse` with query param `limit` (1 to 50, default 5). For one-off jobs, returns the next runtime if future. For completed jobs (`status="done"`), returns an empty list. For `max_runs` jobs, bounds projection by remaining runs (`max_runs - run_count`).
  - **Closed MCP Surface (ADR-005):** Added 11th tool `upcoming_runs(job_id, limit=5)` returning compact single-line JSON. Enriched `get_item` with `upcoming_runs: list[str]` displaying up to 5 formatted timestamps for active recurring jobs.
  - **Web UI (Svelte 5):** Added `#detail-upcoming-card` in the inspection drawer (`#wdg-job-detail`) with numbered badges, local time, manual refresh button, and empty states.

### [2026-10-04] Agenda Tags and Categories (`tags: list[str]` in SQLite v11, Task [02.13])

- **Context:** Operators and agents needed to categorize reminders and routines (e.g., `alert`, `finance`, `reminder`, `oncall`) for filtering and autocomplete.
- **Decision:**
  - **SQLite v11 Schema:** Added column `tags TEXT NOT NULL DEFAULT '[]'` to table `jobs` (`PRAGMA user_version = 11`).
  - **Efficient Filtering via `json_each`:** Tag queries (`GET /jobs?tag=...`) execute `EXISTS (SELECT 1 FROM json_each(jobs.tags) WHERE LOWER(value) = LOWER(?))` avoiding extra relation tables.
  - **Tag Sanitization:** `_clean_tags` strips whitespace, discards empty strings, and deduplicates case-insensitively.
  - **Autocomplete Endpoint `GET /jobs/tags`:** Returns sorted, deduplicated tag lists for UI datalists and agent suggestions.
  - **MCP Integration:** Parameter `tags: list[str]` supported in `schedule` and `preview`; filter `tag: str` supported in `list_agenda`.
  - **Web UI:** Datalist filter in `#wdg-job-filters`, tag badges on table rows, tags card in detail drawer, and chip selector in `#wdg-job-create`.

### [2026-09-29] Morning Digest and Conflict Detection in MCP (`daily_digest`, Task [02.12])

- **Context:** Agents needed a daily consolidated schedule summary without parsing verbose records, alongside preventive detection of overlapping dispatches to the same contact.
- **Decision:**
  - **MCP Tool `daily_digest` (ADR-005):** Added 10th tool calling `GET /jobs/digest`. Accepts `date` and optional `to` filter. Returns compact JSON with `total_jobs`, short agenda summaries, and detected conflicts.
  - **Canonical Conflict Criterion:** Two or more jobs conflict when sharing the same resolved destination (`target_number` or `to`), having `status='scheduled'`, `enabled=true`, and scheduled times within $\le 5$ minutes ($\le 300$ seconds) of each other.
  - **Dual Preventive Warning:** Surfaced both in `daily_digest` and during dry-run simulation via `preview`.

### [2026-09-29] Post-Release v0.4.0 Hygiene and Archive Consolidation (Task [00.9])

- **Context:** Release `v0.4.0` published (`f870cc3`). Completed task logs in `TASK.md` required consolidation to prevent context window bloat.
- **Decision:** Archived completed tasks into `ARCHIVE.md` under `## [v0.4.0] - 2026-09-22`, retaining only current cycle tasks in `TASK.md`.

### [2026-09-28] Bilingual Repository Documentation (README, Task [00.8])

- **Context:** Standardize on primary Technical English `README.md` for international packaging and Portuguese localized mirror `README.pt-br.md`.
- **Decision:** Implemented dual README pattern with top language switchers following `readme-standard` skill.

### [2026-09-28] Agent Skills Standardization (.agent/skills/, Task [00.7])

- **Context:** Standardize all domain skills to the canonical 9-section structure with RFC 2119 priority markers and falsifiable validation checklists.
- **Decision:** Refactored all 7 domain skills (`agenda-job`, `anotar-agenda`, `api-endpoint`, `database-migration`, `due-tick`, `mcp-tool`, `whatsapp-dispatch`) and `000-template.md` into Technical English following `agent-doc-refactor`.

### [2026-09-22] Governance Alignment with Template Hub (template-agent, Task [00.6])

- **Context:** Synchronize with upstream `template-agent:greenfield` standards (precedence hierarchy, circuit breaker, falsifiable DoD, modular context triggers).
- **Decision:** Established 5-tier conflict resolution hierarchy, YAML circuit breaker on 2 consecutive failures, modular context triggers, and conventional commits.

### [2026-09-21] Docker CI/CD and GHCR Publishing (GitHub Actions)

- **Context:** Automated container builds via GitHub Actions to avoid local host compilation bottlenecks.
- **Decision:** `.github/workflows/docker-publish.yml` with BuildKit GitHub Actions cache (`gha`), SemVer tagging, and SHA tags; Compose parametrizes image tag via `HOMELAB_SCHEDULE_VERSION`.

### [2026-09-20] Advanced Recurring Lifecycle (`until`, `max_runs`, Pause, and Snooze, SQLite v10)

- **Context:** Recurrent schedules required expiration dates, max execution quotas, non-destructive pause/resume, and temporary postponement (snooze) without corrupting cron rules.
- **Decision:**
  - **SQLite v10 Schema:** Columns `until TEXT`, `max_runs INTEGER`, `run_count INTEGER NOT NULL DEFAULT 0`.
  - **Automatic Termination:** Scheduler marks job `status='done'`, `enabled=false`, `next_run_at=null` when `run_count >= max_runs` or when calculated next run exceeds `until`.
  - **Pause and Resume:** `POST /jobs/{id}/pause` (`status='paused'`, `enabled=false`) and `POST /jobs/{id}/resume`. Rejects YAML jobs with 409.
  - **Snooze without Cron Mutation:** `POST /jobs/{id}/snooze` adjusts only immediate `next_run_at`; cron cadence recalculates from `now()` on subsequent ticks.

### [2026-09-20] Dead-Letter Alerts for Operator (Critical Gateway Failures)

- **Context:** Proactive operator notification when jobs fail terminally (permanent HTTP 401/422 errors or exhausted retries).
- **Decision:**
  - Configured via `WHATSAPP_ADMIN_NUMBER`. Dispatches alert message directly via `dispatcher.send()` without inserting into SQLite to avoid recursive dead-letter loops. Failures logged in NDJSON without throwing uncaught exceptions.

### [2026-09-20] Custom Variables in Jobs and Templates (SQLite v9)

- **Context:** Support arbitrary key-value variables (`variables: dict[str, str]`) interpolated securely into templates without Jinja2 dependency.
- **Decision:** Persisted as JSON in `jobs.variables` (SQLite v9). Interpolation in `templates.py` replaces keys in descending length order to avoid prefix mangling.

### [2026-09-19] Physical Database Backup, JSON Export/Import, and Integrity Checks

- **Context:** Non-blocking backups and data portability for homelab SQLite data.
- **Decision:**
  - `GET /backup/database`: Uses SQLite Online Backup API (`conn.backup()`) for consistent WAL snapshots.
  - `GET /backup/export`: Structured JSON bundle (`schema_version: 8`) excluding YAML routines.
  - `POST /backup/import`: Atomic transaction supporting `merge` and `replace` modes with foreign key validation.
  - `GET /backup/integrity`: Real-time `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.

### [2026-09-19] Calendar and Timeline Views in Web UI (Svelte 5 Runes)

- **Context:** Visual inspection of future schedule density alongside historical execution records.
- **Decision:** Segmented switcher (`table`, `timeline`, `calendar`) in `#wdg-job-list`. `JobTimelineView.svelte` for vertical chronological stream; `JobCalendarView.svelte` for monthly grid.

### [2026-09-19] Execution Audit History (`job_runs`, SQLite v8)

- **Context:** Granular traceability for every dispatch attempt.
- **Decision:** Table `job_runs` records `id`, `job_id`, `ran_at`, `trigger` (`schedule` | `manual`), `status`, `status_code`, `duration_ms`, and `error_message`. Retained for `JOB_RETENTION_DAYS`.

### [2026-09-19] Dead-Letter and Manual Retry Actions

- **Context:** Failed jobs require manual review and re-queueing without recreating from scratch.
- **Decision:** Exposed `last_error` and `retry_count` in list models; added `POST /jobs/{id}/retry` and `POST /jobs/group/{group_id}/retry`.

### [2026-09-19] Contextual Greetings and Safe Dynamic Variables

- **Context:** Dynamic greetings ("Good morning" / "Good afternoon" / "Good evening") based on dispatch time in `America/Sao_Paulo`.
- **Decision:** Built-in template variables (`greeting`, `greeting_lower`, `saudacao`, `saudacao_lower`, `period`, `day`, `month`, `hour`, `minute`). Ordered substitution prevents substring collisions.

### [2026-09-19] Dry-Run Preview Tool (MCP `preview` and `POST /jobs/preview`)

- **Context:** Side-effect-free simulation of recipient resolution, cron calculation, and template interpolation before persistence.
- **Decision:** Pure in-memory computation returning resolved schedule parameters without database writes.

### [2026-09-19] Advanced Query Filters and Search (MCP `list_agenda` and HTTP)

- **Context:** Search jobs by text query, recipient alias, and relative timeframes.
- **Decision:** SQLite case-insensitive query search, recipient union match (`target_number`, `created_by`, `to`), and deterministic relative period parser (`parse_period`).

### [2026-09-19] Friendly Natural Language Relative Expressions (`when`)

- **Context:** Ergonomic parsing for expressions like `+15m`, `tomorrow 2pm`, `monday 9h` in MCP tools.
- **Decision:** Handled in `mcp_when.py` converting to ISO UTC before issuing HTTP requests.

### [2026-09-15] Visual Group Clustering for Batch Jobs (`group_id`)

- **Context:** Batch dispatches created via `POST /jobs/batch` share `group_id` but appeared dispersed.
- **Decision:** Reactive grouping in `JobsPage.svelte` showing master group row with expand/collapse child rows.

### [2026-09-13] White Theme Opacity Fix (RGB Tokens + Alpha)

- Tailwind 3 requires `rgb(var(--token) / a)` rather than `rgba()`. CSS variables store space-separated channel values `R G B`. Inline script in `index.html` sets dark class before initial paint to prevent flashes.

### [2026-09-13] UI QA Audit Remediations (NF-01 to NF-15, BUG-001 to BUG-013)

- SPA heuristic caching eliminated with `Cache-Control: no-cache, no-store, must-revalidate` on HTML fallback responses and `cache: 'no-store'` on fetch calls.
- Accessible focus trapping implemented via `focusTrap` action.
- Content-Type verification in `api.ts` ensures structured `ApiClientError` on HTML responses.

### [2026-09-13] Batch Send Groups (`group_id`, SQLite v7)

- Multiple recipients modeled as independent job rows linked by indexed `group_id`, preserving atomic execution in the tick loop.

### [2026-09-13] Static UI Serving in FastAPI + Multi-Stage Docker

- Multi-stage build (`node:22-alpine` for Vite Svelte build, `python:3.13-slim` for runtime). FastAPI mounts `/assets` and handles HTML SPA fallback for browser routes while preserving strict JSON responses on API endpoints.

### [2026-09-12] Templates Catalog (SQLite v6)

- Table `templates` with `id`, `name`, `body`. Job references either `template_id` or explicit `content`.

---

## Active Contracts

| Channel / Interface | Producer | Consumer | Payload / Protocol Contract | Notes |
|---|---|---|---|---|
| HTTP `/jobs` | MCP, curl, external callers | homelab-schedule API | [ENDPOINTS.md](ENDPOINTS.md) | Single job scheduling and lifecycle |
| HTTP `/contacts` | Web UI / curl | homelab-schedule API | [ENDPOINTS.md](ENDPOINTS.md) | Contact catalog management |
| HTTP `/templates` | Web UI / curl | homelab-schedule API | [ENDPOINTS.md](ENDPOINTS.md) | Message template catalog |
| HTTP `/backup` | Web UI / scripts | homelab-schedule API | [ENDPOINTS.md](ENDPOINTS.md) | SQLite snapshot, JSON export/import |
| MCP stdio | AI agents | Local HTTP daemon | [ADR-005](adr/005-mcp-superficie-fechada.md) | Closed surface (11 tools) |
| `routines.yaml` | Git / operator | YAML loader + tick watch | [CHANNELS.md](CHANNELS.md) | Declarative permanent routines |
| `POST /send` | Dispatcher tick | Gateway `{WHATSAPP_API_URL}` | `phone_number`, `content`, `quote_id`, `x-api-key` | Outbound dispatch gateway |

Contract modifications require synchronized schema updates across both producer and consumer in the same atomic task.

---

## Critical Traps

- **Outbound `/send`:** Header MUST use `x-api-key`. Body MUST use ONLY `phone_number` and `content`. NEVER use `to`, `body`, `message`, or `Authorization: Bearer`.
- **202 Accepted:** Signifies message is queued in the gateway. NEVER treat 202 as failure and NEVER retry immediately upon 202.
- **Log Hygiene:** Recipient phone numbers, JIDs, and message contents MUST NEVER be output as stream fields in NDJSON logs.
- **SQLite Concurrency:** Exactly one writer process. Forgetting `notebook_changed.set()` on write paths delays near-term dispatches up to the 300-second fallback cap.
- **YAML Routines:** Merge is keyed on stable `id`. HTTP cancellation of YAML jobs MUST return `409 Conflict`.
- **Query Parameter `to`:** On `GET /jobs`, `to` represents end-date timestamp filtering (`datetime`), NOT recipient phone number. Recipient filtering uses `GET /jobs?phone=`.
- **UI Opacity Tokens:** CSS variables define space-separated channels (`R G B`). Always use `rgb(var(--token) / a)`.

---

## Accepted Technical Debt

| Item | Rationale | Resolution Trigger |
|---|---|---|
| No user authentication / OTP in Web UI | Single-operator homelab environment secured by `x-api-key` | If multi-tenant access is needed |
| No high-availability / multi-replica | Single SQLite database with WAL and local tick loop | If migrating off single-node homelab |
