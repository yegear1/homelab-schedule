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
| [ADR-001](adr/001-python-monolith-uv.md) | Single Process FastAPI + SQLite Tick, UV, Python 3.13 | Approved | 2026-09-11 |
| [ADR-002](adr/002-sqlite-and-yaml.md) | SQLite WAL for Reminders and YAML for Permanent Routines | Approved | 2026-09-11 |
| [ADR-003](adr/003-pens-and-notebook.md) | Three In-Repo Pens, Single Shared Notebook | Approved | 2026-09-11 |
| [ADR-004](adr/004-gateway-dispatch.md) | Dispatch Exclusively via POST /send on Configured HTTP Gateway | Approved | 2026-09-11 |
| [ADR-005](adr/005-closed-mcp-surface.md) | Closed Surface MCP Server | Approved | 2026-09-11 |
| [ADR-006](adr/006-tick-next-run.md) | Temporal Dispatch: `next_run_at` UTC Index and Asyncio Tick Loop | Approved | 2026-09-11 |
| [ADR-007](adr/007-in-repo-web-ui.md) | Operator Web UI in Same Repository (`web/` and `proto/`) | Approved | 2026-09-12 |

---

## Architectural Decisions Beyond ADRs

- **Task [02.25] — History/Data replacement (2026-11-08):** Dedicated routes preserve browser history and all backup entry IDs; the old BackupModal is a navigation bridge. History uses generation-guarded bounded reads and the shared inspector; CSV uses applied status without list limit. Data splits download/import/integrity controls, validates unknown JSON shape, previews actual array counts, confirms replace in a focus-trapped dialog and preserves failed drafts, summaries, skipped counts and warnings. Navigating after import mounts fresh catalog/agenda/history reads.
- **Replacement verification traps:** The runtime ignore rule is rooted at `/data/` so `web/src/components/data/` is tracked. The import preview consumes the alpha/spacing utilities previously generated only by the retired modal; the foundation test must still check real generated CSS. Real-app browser forwarding must select fetch requests, otherwise path fragments in Svelte module URLs can intercept component imports. Disposable SQLite and a fake loopback gateway provide integration coverage; physical-device QA is not claimed. C01–C19 traceability is recorded in `WEB_UI_REBUILD.md` §10.

- **Task [02.24] — Contact/template workspaces (2026-11-08):** Rebuilt directory, contact detail and template catalog/editor using shared semantic controls. Contact create/edit share a guarded form; edits send only changed fields, unchanged saves stay local, and phone changes reset recipient/creator defaults and reload the destination-or-creator query. Contact job reads remain independent from identity edits and reuse composer/inspector/actions.
- **Catalog mutation and preview contracts:** Failed writes retain drafts; confirmations precede deletion and 409 keeps referenced records. Busy saves block duplicate submission, selection/reset and conflicting deletion. Successful creation clears the draft before refreshing, so a failed read cannot invite duplicate creation. All 17 known placeholders insert at the current selection; preview uses sample identity/browser-local time, remains explicitly illustrative, and leaves unknown/custom tags literal.
- **Catalog layout/test traps:** Template columns use available container width via auto-fit, preserving reflow at 200% CSS zoom. Access-dialog contrast checks scope the primary-button selector to the dialog because catalog forms now share the same primitive. Name read state `resource` instead of `state` in Svelte components to avoid TypeScript confusing `$state` with a store subscription. No dependencies or backend contracts changed.

- **Task [02.23] — Agenda workspace (2026-11-08):** Replaced the legacy agenda, grouped table, timeline and calendar with scoped Svelte components and typed client orchestration. Explicit submitted filters share one normalized query with agenda CSV; exports omit list limit and ignore unapplied drafts. Global attempts remain a separate bounded read (100) and global CSV retains its independent scope. No backend, dependency or production changes.
- **Agenda read and presentation contracts:** Request generations discard stale lists/catalogs/attempts. List and attempts distinguish loading/error/empty/ready; missing history never appears as zero known attempts in the calendar. Counts describe the loaded subset; group actions use whole-group server eligibility. Calendar shows loaded dates rather than expanding cron and supports arrow/Home/End selection plus month/year navigation.
- **Agenda integration traps:** Shared row actions suppress inspector-only IDs to avoid duplicate anchors. Group expansion replaces plain Set instances after changes so Svelte invalidates membership reads. Source contracts now follow extracted components; 95 browser tests and 247 Python tests passed, along with mypy, Ruff, Svelte/config checks, build and diff check. Screenshot review covers mobile/desktop and dark mode; physical-device testing is not claimed.

- **Task [02.22] — Shared inspector (2026-11-08):** Agenda and Contact share the responsive job inspector, bounded group members (100), history (20), upcoming projection (5), lifecycle dialogs and authenticated selected-job CSV. Selection/request generations discard stale reads; each section keeps independent loading/error/empty/ready states. Mobile uses the shared modal focus stack; desktop close restores the inspection trigger. Opening is explicit to avoid trapping focus on mobile list load.
- **Inspector mutation contract:** Retry requeues; run-now reports 202 queued without claiming delivery. YAML mutations stay unavailable. Busy actions ignore duplicate events; dialogs preserve failed drafts, validate future instants and keep snooze payloads independent of cron. List refresh invalidates detail reads; group actions use existing group routes and disclose bounded member lists.
- **Agenda width trap:** Tailwind utility `min-w-[660px]` overrode the 1080 px component-layer table minimum, squeezing title buttons behind adjacent cells. The integration now uses `min-w-[1080px]`; complete agenda replacement remains [02.23].

- **Task [02.21] — Shared composer (2026-11-08):** Agenda and Contact now mount the same typed composer. Client-only payload assembly preserves single `/jobs` versus `/jobs/batch`, content XOR template, ISO conversion of browser-local instants, contact recipient/creator defaults, variables/tags and lifecycle fields. Server remains authoritative for cron, recipient resolution and persistence.
- **Composer mutation state:** Pending recipient text is included once; in-flight submission disables fields and ignores duplicate events. Server failure preserves the draft and allows only explicit retry. Successful creation resets the draft and editor instances; list-refresh failures report that creation already succeeded instead of inviting a duplicate job.
- **Picker/editor continuity:** Native contact buttons support keyboard selection, visible loading/error/empty states and retry. Request generations ignore stale catalog/picker results. Variable replacement/removal, tag normalization/removal/autocomplete and recipient/tag/variable Enter shortcuts remain available. Source anchor tests moved with extracted fields, including lifecycle fields; browser tests verify actual payloads and failure behavior.
- **Composer validation:** 42 browser tests and 247 Python tests, strict typing, Ruff, Svelte checks and build passed. Mobile composer screenshot reviewed; production endpoints, real dispatch and dependency installation were not used.

- **Task [02.20] — Shared shell and modal presentation (2026-11-08):** Rebuilt labelled responsive navigation, access controls and theme selection using typed Svelte 5 primitives and existing semantic tokens. No new dependencies or backend contracts. Original routes, branding, storage names, backup entry IDs and toast live-region ID remain.
- **Modal stack contract:** Shared focus action makes background branches inert, locks body scroll, routes Escape/Tab only to the top trap and restores the connected trigger. Existing modal close buttons bridge the old entry points until their planned rebuild. Dialog height is bounded by its containing viewport, including CSS zoom; cancelled initial-focus frames cannot steal focus after close.
- **Shell validation:** 31 local browser tests and 247 Python tests passed, including all specified widths, 200% CSS zoom, pre-hydration light/dark/system themes, nested Escape, contrast, reduced motion and relative base-URL compatibility. Screenshot review covers mobile shell and light/dark access dialogs; physical-device testing is not claimed.

- **Pre-Approved Tasks (`APPROVED`), Parallel Waves (`[PARALLEL: Wx]`) & `task-queue` Skill:** Tasks finalized during interactive planning use `Status: APPROVED` in `.agent/TASK.md` (with independent disjoint-file tasks tagged `[PARALLEL: Wx]` + `Paths:`), allowing fresh sessions (`proceed`) or isolated worker subagents and multi-account quota failover (`task-queue` skill on `proceed queue`) to transition directly to `RUNNING` without a redundant `PLANNING` pause, halting only when ambiguities, unapproved dependencies, or blockers require human intervention.


### [2026-11-08] Tailwind 4 and Browser Foundation (Task [02.19])

- Pinned `tailwindcss`/`@tailwindcss/vite` 4.3.5 and development-only `@playwright/test` 1.65.0. Peer metadata permits existing Vite 5.4.21 and Svelte plugin 4.0.4; neither was upgraded. Clean `npm ci` succeeded. Removed unused direct PostCSS/Autoprefixer dependencies; config files remain explicit retired stubs.
- CSS `@theme inline` replaces the JS theme config; RGB channel storage now uses `--palette-*` for legacy colors, avoiding collisions with Tailwind's full-color `--color-*` namespace. Semantic channel names (`--label`, `--accent`, etc.) and alpha behavior remain. Existing consumers of raw legacy color variables were confined to app.css and the updated token tests.
- Vite defaults to a loopback backend at localhost:8003, configurable through server-only `SCHEDULE_DEV_API_URL`. All seven API prefixes are proxied, including backup. HTML document navigation on shared paths bypasses the API proxy for the SPA; JSON requests retain backend meaning.
- `npm --prefix web run test:e2e` strictly typechecks its configuration/tests and runs Chromium against fresh loopback Vite/Python fixtures. Ports 15173/18003 are reserved for this harness and never reused. External browser traffic is blocked. No real DB, key or gateway is involved; outputs are under /tmp. See `web/tests/README.md` for browser installation and commands.
- Validation: 10 browser scenarios and 247 Python tests passed; strict mypy, Ruff, frontend/config type checks and build passed. Browser coverage is foundational; full feature/mobile/device QA remains assigned to later tasks.

### [2026-11-08] Operator Credentials and Browser Transport (Task [02.18])

- Removed browser credential fallback. Absent storage/server-side access returns an empty key; JSON, CSV and SQLite requests attach `x-api-key` only when the operator supplied a key. Existing key/base URL storage names and public client methods remain unchanged.
- All transports share no-store fetch, structured network/HTTP errors and guarded unknown error-body parsing. Successful downloads validate CSV or the backend's `application/x-sqlite3` media type. HTML fallback never becomes a successful data download.
- Shell credential status refreshes when the access dialog closes, including saving/clearing credentials. No failed mutation is replayed.
- `tests/web/test_api_auth.py` runs the actual transport under Node 22 native TypeScript stripping through canonical pytest; no bundler or package installation. Synthetic fetch/storage isolate tests from production. Frontend runtime interaction coverage follows in [02.19].

### [2026-11-08] Web UI Rebuild Planning (Task [02.17])

- Capability inventory C01–C19 and draft sequential tasks live in [WEB_UI_REBUILD.md](WEB_UI_REBUILD.md). `INTERFACE.md` reconciles the observed baseline and labels proposed History/Data routes separately; operator approved the plan, surface/locale and named dependencies on 2026-11-08.
- Keep existing presentation intact during planning. Preserve transport/types/auth storage, same-origin serving, original paths and `proto/`; replace presentation in scoped steps after approval. No new backend routes or dispatch logic.
- The tracked browser client contains a credential fallback; issue #1 explicitly requires its removal. Do not reproduce the literal in documentation, fixtures or generated assets. Operator key storage remains; absence must yield an empty key. Credential rotation is outside this planning task.
- Existing web tests mostly inspect source strings. Replace structural assertions with traceable behavior coverage during each migration; preserve loaded-list/count/calendar bounds rather than implying global aggregates or full cron expansion.
- Tailwind 4 Vite integration and development-only Playwright were approved on 2026-11-08. Preserve fixed pt-BR and light/system/dark preferences.

### [2026-10-31] Open Source Readiness and Community Governance (Task [00.12])

- Aligned project with canonical open source readiness standards (`oss-readiness`): MIT License scaffolded with SPDX manifest declarations across Python (`pyproject.toml`) and Web UI (`web/package.json`).
- Community governance established under Contributor Covenant 2.1 (`CODE_OF_CONDUCT.md`), architecture and development guidelines (`CONTRIBUTING.md`), responsible vulnerability disclosure policy (`SECURITY.md`), and GitHub PR and issue templates (`.github/`).
- Verified PyPI package namespace `homelab-schedule` (AVAILABLE) and sanitized `.env.example` comments in Technical English.
- Local repository git config updated to anonymous GitHub noreply author identity (`yegear1@users.noreply.github.com`).

### [2026-10-31] Operational Metrics (Task [02.16])

- Authenticated `GET /health/metrics` and the explicit `health_metrics` MCP tool return only aggregate counts and timestamps. The MCP remains an HTTP bridge; ADR-005 authorizes this bounded read-only addition. Public `/health` stays unchanged.
- Job counts include persisted SQLite/YAML rows. Overdue means enabled scheduled jobs strictly before the UTC reference instant. Attempt metrics cover all retained manual/scheduled attempts in the inclusive 1–168 hour window (default 24), without list truncation. Empty history yields null percentage, mean duration, and latest timestamp.
- `attention_required` means overdue/error jobs or failed attempts in the window. Gateway acceptance is attempt success, not delivery confirmation. This is not a scheduler/gateway availability probe. Separate aggregate reads can reflect concurrent changes, and retention bounds history.

### [2026-10-31] Tabular CSV Export

- Authenticated `/jobs/export.csv` reuses agenda filters and includes SQLite/YAML jobs; `/jobs/runs/export.csv` supports status/job filters. Both export all matching rows independently of list limits, with stable model-field columns, UTF-8 BOM, CRLF, ISO timestamps, compact JSON compound cells, and empty null cells.
- The job service serializes CSV; repository reads use 256-row ID keyset batches. Each batch finishes its read before streaming resumes, without a long transaction. Exports have no cross-batch snapshot guarantee during concurrent writes. The browser assembles the authenticated response as a Blob before downloading.
- Leading spreadsheet formula operators (including after whitespace) and tab/CR/LF in text cells receive an apostrophe. CSV is a spreadsheet report; JSON backup remains the lossless portability format. Agenda and per-job history downloads preserve existing JSON/list contracts and revoke temporary object URLs.

### [2026-10-31] Agenda Presentation

- Agenda table, timeline, and calendar share semantic panels and existing control primitives (44 px touch targets, visible focus, fluid motion, and reduced-motion handling). Selection is exposed through `aria-pressed` or `aria-current`; calendar day labels include event counts and errors.
- The fixed-column agenda table has a 1080 px minimum width and a named, keyboard-focusable horizontal scroll region. Job titles, group titles, and member destinations are native inspection buttons; propagation guards preserve nested actions and group behavior.
- Calendar grids retain seven columns with a 308 px minimum width inside a scrollable panel. Event actions wrap, narrow-screen day indicators truncate, and the detail panel stops sticking on mobile. DOM IDs, filtering, grouping, API calls, and payloads remain unchanged.

### [2026-10-31] Support Screen Presentation

- Templates, contacts, and contact detail use semantic surface, label, separator, and accent tokens. Shared `support-page` styles remain scoped to these screens; `support-panel` provides consistent card rounding and subtle shadows.
- Controls have 44 px minimum touch targets and visible keyboard focus. Contact rows wrap on narrow screens, action groups wrap, and status filters retain horizontal scrolling. Job titles provide native keyboard buttons while preserving card click and nested action behavior.
- Reduced motion disables decorative spinners, pulses, and press scaling, and template editing scrolls instantly. Existing DOM IDs, field names, state markers, API calls, and payloads remain unchanged.

### [2026-10-31] Shared Modal and Toast Presentation

- The five global modals share scoped CSS primitives for semantic surfaces, 44 px controls, visible keyboard focus, safe-area padding, and viewport-bounded scrolling. Component scripts, existing DOM IDs, HTTP payloads, and focus-trap actions remain unchanged.
- Modal entrance and Toast visibility use existing fluid motion tokens. Reduced motion disables modal animation and press scaling; token durations remove Toast transitions. Dialog titles and close controls have accessible names, and Toast announces messages through a polite status region.
- Validation in the restricted execution environment requires a writable `UV_CACHE_DIR`. If TestClient stalls before the first test completes, rerun the suite outside the sandbox before attributing the stall to application changes.

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
| MCP stdio | AI agents | Local HTTP daemon | [ADR-005](adr/005-closed-mcp-surface.md) | Closed surface (12 tools) |
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
