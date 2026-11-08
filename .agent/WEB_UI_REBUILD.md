# Web UI Rebuild — Task [02.17]

**Status:** Approved by operator on 2026-11-08 (`proceed`), including surface, locale and proposed dependencies.
**Evidence date:** 2026-11-08.
**Request:** [Issue #1](https://github.com/yegear1/homelab-schedule/issues/1).
**Contract:** [INTERFACE.md](INTERFACE.md). Existing presentation remains intact during planning.

## 1. Capability inventory and destination

Every row is a preservation requirement unless explicitly marked proposed. Existing
API capability alone does not establish an existing UI feature.

| ID | Current evidence | Capability to preserve | Rebuild destination / acceptance scenario |
|---|---|---|---|
| C01 | `lib/api.ts`, `components/ApiKeyModal.svelte` | Operator key and optional base URL saved in browser; same-origin default; `x-api-key`; JSON/204/network/validation errors | Shell access dialog; save/reload retains settings; blank key has no fallback; 401 offers configuration |
| C02 | `lib/router.svelte.ts`, `App.svelte` | Contacts, contact detail, templates, jobs; browser history and direct links; `/` opens contacts | Preserve these paths and root behavior; add `/history` and `/data`; back/forward restores correct screen |
| C03 | `lib/theme.svelte.ts`, `index.html`, `AppShell.svelte`, `Toast.svelte`, `focusTrap.ts` | Light/system/dark persisted theme; early theme application; shared icon; responsive navigation; status toasts; dialog focus/Escape | New shell and shared primitives; no first-paint theme flash; keyboard focus returns to trigger |
| C04 | `pages/ContactsPage.svelte` | Load/refresh directory; local name/phone/ID search, count, create contact and open detail | Contacts page with search, list and creation; duplicate/invalid/network/empty cases visible |
| C05 | `pages/ContactDetailPage.svelte` | Load/edit only changed fields; unchanged feedback; confirmed delete; scheduled-job conflict; jobs matching destination OR creator; status filter | Contact workspace; changing phone reloads matching jobs; delete conflict retains record |
| C06 | `pages/ContactDetailPage.svelte` | Contact-prefilled single-job scheduling and creator default; template pick/clear; inspect/cancel/reschedule/run | Reuse composer/inspector; preserve contact phone as recipient and initial creator |
| C07 | `pages/TemplatesPage.svelte` | Catalog refresh, name/ID/body search, count, create/edit/reset/confirmed delete; name/body counters and conflict alert | Templates workspace; referenced template cannot disappear after 409 |
| C08 | `pages/TemplatesPage.svelte`, `test_templates_placeholders.py` | Placeholder insertion at cursor, known-tag guide, unknown-tag warning, illustrative live preview including greetings/time/name/date | Shared template editor; unknown/custom tags stay literal; preview clearly labelled illustrative |
| C09 | `pages/JobsPage.svelte` | Agenda status/date/phone/limit/tag filters; reset/refresh; tag autocomplete; error-card shortcut; contact/alias display | Agenda filter bar and error shortcut; submitted values and CSV filters agree; counts labelled as loaded subset |
| C10 | `JobsPage.svelte`, `ContactPickerModal.svelte` | Once/cron creation; direct text XOR template; recipient chips (manual aliases/numbers, separators, dedup/removal), contact search/pick; creator picker | One shared composer; one recipient uses `/jobs`, multiple use `/jobs/batch`; pending typed recipient included |
| C11 | `JobsPage.svelte`, `test_jobs_variables.py`, `test_jobs_tags.py` | Custom variable add/replace/remove; tag add/dedup/remove; lifecycle end date/max runs | Composer advanced section; payload retains variables/tags/until/max_runs; invalid timing and empty content rejected |
| C12 | `JobsPage.svelte`, `test_jobs_grouping.py` | Group master/member rows; collapsed by default; individual/all expansion; group counts/status; member inspection | Agenda grouped table and inspector members; mixed statuses retained; visible subset not presented as whole group |
| C13 | `JobsPage.svelte`, `RescheduleModal.svelte`, `SnoozeModal.svelte` | Individual cancel/run/retry/pause/resume/snooze/reschedule; group cancel/run/retry/pause/resume/snooze; snooze quick offsets and custom future date | Shared action controls/dialogs; group actions use group routes; no invented group reschedule route |
| C14 | `JobsPage.svelte`, `test_jobs_dead_letter.py` | Inspect full message, source, state, timing, recipient/creator/template, variables/tags, lifecycle counters; error/retry count; retry/run recovery | Shared inspector with distinct retry and run-now actions; YAML restrictions explained |
| C15 | `JobsPage.svelte`, `test_jobs_runs.py`, `test_jobs_upcoming.py` | Selected job history (20 currently) and upcoming occurrences (5), independent refresh and empty/loading states | Inspector tabs/sections; preserve HTTP bounds and retention semantics; failed read is an error, not empty |
| C16 | `JobTimelineView.svelte`, `test_jobs_calendar_timeline.py` | Chronological future/history/all toggle; global attempts (100 currently); refresh; execution status/code/duration and inspection | Agenda timeline plus dedicated history screen; no claim of unlimited history |
| C17 | `JobCalendarView.svelte`, `test_jobs_calendar_timeline.py` | Monthly grid, previous/next/today, day selection/detail, scheduled/attempt counts, error indicators, inspect/actions | Agenda calendar; retain seven weekdays and keyboard selection; only loaded next occurrences, not full cron expansion |
| C18 | `JobsPage.svelte`, `lib/api.ts`, `INTERFACE.md` §10 (prior version) | Filtered agenda CSV, all retained runs CSV, selected-job runs CSV; auth, media check, Blob cleanup, busy/error/status | Agenda, History and inspector downloads; exports independent of list limit |
| C19 | `BackupModal.svelte`, `test_backup_ui.py` | Online SQLite snapshot; JSON export with optional runs; select/parse JSON and preview record counts; merge/replace import; explicit replace confirmation; summary/warnings; integrity/FK results | Dedicated Data page reached from existing shell backup entry points; malformed file sends no request; cancel replace sends no request |

### Evidence and coverage limits

- `tests/web/*.py` mostly assert source strings, filenames and handlers. They do
  not prove runtime interaction, responsive layout, keyboard operation or HTTP
  request correctness. Preserve their user requirements while replacing structural
  assertions alongside each migrated feature; never delete coverage just to pass.
- `tests/homelab_schedule/test_jobs_api.py`, `test_contacts.py`,
  `test_templates_api.py`, `test_backup.py`, `test_health_metrics.py` and
  `test_spa_static.py` cover server behavior. The rebuild must keep them passing.
- Agenda numbers currently derive from fetched jobs, not aggregate metrics.
  Calendar/timeline are bounded loaded records. Upcoming cron projection is a
  separate detail request. Preserve these meanings and disclose bounds.
- API client exposes textual `query` and run `status` options without a current
  agenda text-search/global run-status control. These are proposed UI additions,
  not preservation claims. Preview, digest and operational metrics have no current
  browser caller; keep them outside this rebuild unless separately approved.

## 2. Contract reconciliation

The prior contract's September approval predates batch/lifecycle/history/backup,
variables/tags/upcoming and CSV work. `INTERFACE.md` now records the observed
baseline and proposed destinations separately, with status `Outdated` pending
human review. Backend routes and payloads remain unchanged.

| Stale assumption / trap | Resolution in this plan |
|---|---|
| Four screens cover all operational work | Keep original routes; propose History and Data for existing overloaded flows |
| No backup UI / incomplete route inventory | Bind all four backup endpoints to Data; preserve all import modes/confirmation |
| Only cancel/reschedule/run exist | Inventory all individual/group lifecycle and recovery routes |
| Missing tags/variables/lifecycle/upcoming | Specify composer, list and inspector coverage explicitly |
| Hardcoded API-key fallback in tracked browser client | Remove in first implementation task; never copy to fixtures/docs/builds; preserve operator-supplied key storage |
| API `/jobs?to=` mistaken for recipient | `to` is upper date bound; `phone` is recipient OR creator; create payload `to` still means recipient |
| API route paths overlap SPA paths | Keep existing Accept/content-type and HTML fallback behavior; test direct browser entry and API JSON separately |
| Local illustrative template preview looks authoritative | Label it as sample output; backend remains renderer/cron authority |
| Vite proxy targets host and omits backup prefix | Propose local configurable dev target (default localhost:8003) for all API prefixes; no production calls in tests |

## 3. Proposed screen and interaction map

Primary navigation: Agenda (`/jobs`), Contacts (`/contacts`), Templates
(`/templates`), History (`/history`), Data (`/data`). Preserve `/` → Contacts.
Contact detail remains `/contacts/{contactId}` with a back link and scoped agenda.
Do not add a dashboard, health monitor, accounts, bot, YAML editor or polling.

- **Agenda:** Header with create/refresh/export, compact status/error summaries,
  filter bar, table/timeline/calendar switch and one inspector. Preserve filters
  when changing view. Group controls remain available in table and inspector.
- **Contact:** Identity/edit region, scoped agenda and contact-prefilled shared
  composer/inspector. Saving a new phone refreshes the union-match query.
- **Templates:** Search/list beside editor on wide screens; stacked editor on
  narrow screens. Keep placeholder tools, sample preview and deletion conflicts.
- **History (proposed extraction):** Global retained attempts with manual refresh,
  optional existing API status filter, limit and CSV download. Keep timeline
  history available in Agenda; selecting an attempt opens its job inspector.
- **Data (proposed extraction):** Snapshot, JSON export, import and integrity
  sections. Preserve optional run export, counts preview, merge/replace choice,
  replacement confirmation, summaries and warnings. Refresh affected client state
  after successful import. Existing backup shell buttons navigate here.
- **Access:** Masked key and optional base URL dialog in shell. Persist existing
  storage keys. Missing/invalid key presents configuration and explicit retry;
  saving settings updates connection state. Never auto-replay failed mutations.
- **Composer:** Single form reused in Agenda and Contact; compact timing/message/
  recipients sections plus advanced tags/variables/lifecycle. Dialog on desktop,
  viewport-bounded sheet on mobile; contact picker can open above it safely.
- **Inspector:** Side panel on wide layouts, labelled modal sheet on mobile.
  Summary/actions/message/members/history/upcoming stay reachable without hover.
  Closing restores focus and never triggers dispatch.

## 4. Component and state boundaries

Retain Svelte 5, TypeScript strict mode, Vite and the single FastAPI static runtime
(ADR-007). No backend service or API changes are needed.

| Layer / proposed path | Responsibility |
|---|---|
| `lib/api.ts`, `lib/types.ts` | Preserve public methods/types and HTTP semantics; remove key fallback; narrow untrusted errors/import JSON from `unknown` |
| `lib/router.svelte.ts`, `theme.svelte.ts`, `toast.svelte.ts`, `focusTrap.ts` | Browser navigation/preferences/notifications/focus; update internals only with behavioral coverage |
| `lib/jobs/` | Typed client view state, grouping and request orchestration; no server cron, dispatch or persistence logic |
| `components/ui/` | Button, Field, Panel, StatusBadge, SegmentedControl, Dialog, EmptyState, ErrorState, Toast |
| `components/jobs/` | JobFilters, JobComposer, RecipientChips, VariableEditor, TagInput, JobActions, JobInspector, GroupMembers, RunHistory, UpcomingRuns |
| `components/JobTimelineView.svelte`, `JobCalendarView.svelte` | Retained entry files with replaceable internals and existing DOM anchors |
| `pages/`, `layout/` | Thin screen composition, route context and accessible navigation |

Use `$props`, `$state`, `$derived` and cleanup-aware `$effect`; explicit typed
callbacks and discriminated loading/error/data state. Ignore or abort stale reads
when switching selected job/route; a slower old request must not replace current
selection. Disable duplicate mutations while busy. Server remains authoritative
for lifecycle, cron, recipients, conflicts, template rendering and retention.

## 5. Proposed surface, tokens and accessibility

**Review axes:** Apple HIG archetype; layered opaque content with restrained
translucency only in shell; single-operator audience; compact but readable density;
restrained feedback motion; plain pt-BR copy; responsive application format.
Retain fixed `pt-BR`, light/system/dark and existing localStorage keys.

- Color roles: background, raised surface, label, secondary label, separator,
  accent/on-accent, success, warning, error and focus. Keep space-separated RGB
  channels and alpha-safe `rgb(var(--token) / alpha)` semantics. Map existing
  aliases while old/new components coexist; remove aliases only after no consumers
  remain. Contrast: body/control text ≥4.5:1; focus/control boundaries ≥3:1.
- Spacing scale: 4/8/12/16/24/32 px; 12 px control radius, 16 px panel radius.
  System UI font; 16 px form inputs, 14–16 px body and 20–28 px headings; tabular
  numbers for timestamps/counters; avoid decorative technical telemetry.
- Width <640 px: single column, wrapping toolbars, labelled navigation, modal
  inspector, composer uses available height and safe-area padding. 640–1023 px:
  compact navigation and stacked workspaces. ≥1024 px: persistent navigation and
  optional side inspector. Table alone may scroll horizontally in a named,
  keyboard-focusable region; page controls never require horizontal scrolling.
- Use `100dvh` with fallback, visible focus, ≥44 px touch targets, labelled fields,
  inline validation, native buttons/links, `aria-current` navigation and polite
  status announcements. Support 200% zoom and keyboard-only navigation.
- Modal focus trap/restoration and Escape affect the topmost dialog only. Loading,
  empty, failure, 401, missing resource and YAML restrictions have distinct copy.
  Color alone never communicates job/attempt status.
- Preserve 100 ms press and 280 ms selection with existing easing; animate
  opacity/transform for feedback only. `prefers-reduced-motion` removes motion,
  press scale, smooth scroll and decorative looping indicators.

## 6. Tailwind 4 and dependency decision

Current manifest: Tailwind ^3.4.13, Vite ^5.4.8, Svelte ^5,
`@sveltejs/vite-plugin-svelte` ^4, PostCSS and Autoprefixer. Do not upgrade the
whole toolchain opportunistically.

Proposed approval: upgrade `tailwindcss` to stable 4.x and add matching stable
`@tailwindcss/vite`; add development-only `@playwright/test` for behavior tests.
Resolve exact releases/peer ranges from registry metadata at implementation time,
record them in package-lock and verify against installed Vite/Svelte/Node. Keep
Vite 5/plugin 4 if peer-compatible; if not, stop with concrete version options
before any additional toolchain/dependency change. No installs during planning.

Migration: add Tailwind Vite plugin beside Svelte; replace v3 directives with CSS
import; move theme extensions to CSS theme tokens; preserve class-based dark
mode explicitly. Retain legacy utility compatibility while replacing pages.
Review preflight, borders/rings/shadows, opacity and Svelte-local style references.
Retire PostCSS/Autoprefixer configuration only after checking all consumers and
passing build. Verify generated CSS has real token/color utilities.

The [official Vite integration](https://tailwindcss.com/docs/installation/using-vite)
uses `@tailwindcss/vite` and a CSS import. The
[upgrade guide](https://tailwindcss.com/docs/upgrade-guide) sets browser floors
Safari 16.4+, Chrome 111+, Firefox 128+ and describes changed utility defaults.
These floors are part of the proposed approval; older-browser support requires
revisiting the migration. No CDN runtime or additional UI/icon/font package.

## 7. Replacement gate and rollback

Planning approval must cover this screen map, surface, dependency set and tasks.
Operator approval on 2026-11-08 covers the sequential tasks below.

1. Complete client/security and test foundations while old presentation works.
2. Replace shell and shared presentation, then replace each feature in place in
   the specified sequence. Clear each old presentation body as its working
   replacement lands; do not retain the old visual design as the final product.
3. Never clear `web/` wholesale. Preserve manifest/lock, entry points, icon,
   transport/types/auth, router/theme/focus utilities, tests and `proto/` references.
   Existing component files can become wrappers around new components to keep
   anchors and imports stable during migration.
4. Each task lands as an atomic Conventional Commit with passing checks. A failed
   task remains active; no next-task promotion until its acceptance criteria pass.
   Rollback through a targeted revert of that task's commit, never destructive
   resets, data changes, build publication or production deploys.

## 8. Sequential implementation tasks (draft)

Each task may update `.agent/TASK.md` and `.agent/NOTES.md` for its own completion.
Shared paths intentionally make this a sequential queue; no parallel tags.
Every task also requires the common checks in §9.

### [02.18] Remove credential fallback and preserve transport behavior

**Paths:** `web/src/lib/api.ts`, `web/src/lib/types.ts`,
`web/src/components/ApiKeyModal.svelte`, `web/src/layout/AppShell.svelte`,
`tests/web/test_api_auth.py` (new).

**Accept:** No embedded key/default credential in source/build; blank browser
storage yields empty key; stored key/base URL still work after reload; JSON/CSV/
SQLite requests send only operator-supplied authentication; 204 succeeds; wrong
media type/network/401/404/409/422/502 produce explicit errors. No visual reset.
Use existing test tooling for the initial credential regression.

### [02.19] Add browser behavior harness and Tailwind 4 foundation

**Paths:** `web/package.json`, `web/package-lock.json`, `web/vite.config.ts`,
`web/postcss.config.js`, `web/tailwind.config.js`, `web/src/app.css`,
`web/playwright.config.ts` (new), `web/tests/` (new),
`tests/web/test_theme_tokens.py`.

**Accept:** Approved package versions satisfy peers; lockfile reproducible; no
production network used by tests; declare `test:e2e` script; all API prefixes including backup reach a local
dev target; existing screens build/render; theme alpha utilities resolve in both
modes; browser harness verifies stored/absent key and JSON-vs-HTML errors with
synthetic data; no existing feature assertion silently dropped.

### [02.20] Replace shell and shared presentation primitives

**Paths:** `web/src/layout/AppShell.svelte`, `web/src/components/ui/` (new),
`web/src/components/ApiKeyModal.svelte`, `web/src/components/Toast.svelte`,
`web/src/lib/focusTrap.ts`, `web/src/lib/theme.svelte.ts`, `web/src/app.css`,
`web/index.html`, `web/tests/shell.spec.ts` (new).

**Accept:** Proposed shell/tokens replace old presentation; original navigation
works; 320/390/768/1440 px layouts and 200% zoom keep controls reachable; persisted
light/system/dark without flash; text/focus contrast passes; topmost modal Escape,
focus trap/restoration, status announcements and reduced motion work.

### [02.21] Rebuild shared composer and contact/template pickers

**Paths:** `web/src/components/jobs/JobComposer.svelte` and editor helpers (new),
`web/src/components/ContactPickerModal.svelte`, `web/src/lib/jobs/` (new),
`web/src/pages/JobsPage.svelte`, `web/src/pages/ContactDetailPage.svelte`,
`tests/web/test_jobs_variables.py`, `tests/web/test_jobs_tags.py`,
`web/tests/composer.spec.ts` (new).

**Accept:** C06/C10/C11 scenarios succeed with exact single/batch request bodies;
contact defaults preserved; once/cron/content-template validation; recipient
chips/picker/creator/tags/variables/lifecycle retained; malformed form makes no
request; failures retain form inputs; duplicate submissions prevented.

### [02.22] Rebuild inspector, lifecycle and group actions

**Paths:** `web/src/components/jobs/` inspector/action/history/upcoming components,
`web/src/components/RescheduleModal.svelte`, `web/src/components/SnoozeModal.svelte`,
`web/src/pages/JobsPage.svelte`, `web/src/pages/ContactDetailPage.svelte`,
`tests/web/test_jobs_lifecycle.py`, `test_jobs_dead_letter.py`, `test_jobs_runs.py`,
`test_jobs_upcoming.py` (all under `tests/web/`), `web/tests/inspector.spec.ts` (new).

**Accept:** C13–C15 including group variants and CSV; YAML disallows forbidden
mutations; 202 says queued; retry differs from run-now; snooze preserves cron;
changing selected job cannot show stale history/upcoming; independent loading,
empty and failed states; mobile modal and desktop panel retain anchors.

### [02.23] Rebuild agenda table, timeline and calendar

**Paths:** `web/src/pages/JobsPage.svelte`, `web/src/components/jobs/` agenda
components, `web/src/components/JobTimelineView.svelte`,
`web/src/components/JobCalendarView.svelte`, `web/src/lib/jobs/`,
`tests/web/test_jobs_grouping.py`, `tests/web/test_jobs_calendar_timeline.py`,
`web/tests/agenda.spec.ts` (new).

**Accept:** C09/C12/C16–C18; filters/reset/view transitions and group expansion
work; loaded counts and calendar scope explicit; selected day keyboard access;
CSV excludes list limit and preserves active filters; text query control is an
approved addition using existing API; empty/error/loading are distinct; inspector
and composer remain usable in all views.

### [02.24] Rebuild contacts and templates workspaces

**Paths:** `web/src/pages/ContactsPage.svelte`,
`web/src/pages/ContactDetailPage.svelte`, `web/src/pages/TemplatesPage.svelte`,
`web/src/components/contacts/`, `web/src/components/templates/` (new),
`tests/web/test_templates_placeholders.py`, `web/tests/catalogs.spec.ts` (new).

**Accept:** C04–C08; search/CRUD/reset/counters/confirmation and 409 conflicts;
contact edits refresh phone-bound jobs; shared job flows work; all placeholder
buttons insert at cursor and preview remains illustrative; unknown tags persist;
no fabricated telemetry/status. Original route links work after reload/history.

### [02.25] Extract History/Data pages and verify full replacement

**Paths:** `web/src/pages/HistoryPage.svelte`, `DataPage.svelte` (new),
`web/src/components/BackupModal.svelte`, `web/src/App.svelte`,
`web/src/lib/router.svelte.ts`, `web/src/layout/AppShell.svelte`,
`web/src/components/data/` (new), `tests/web/test_backup_ui.py`,
`web/tests/history-data.spec.ts` (new), `.agent/INTERFACE.md`,
`.agent/WEB_UI_REBUILD.md`.

**Accept:** C02/C16/C18/C19; new routes support direct entry/back/forward; existing
backup triggers reach Data; history status/limit filters use documented queries;
merge/replace, preview counts, cancel replacement, warnings/integrity/downloads
work. No request to production or direct `/send`. All C01–C19 browser scenarios
pass, all previous source-string requirements have traceable replacement coverage,
no old presentation sections remain, screenshots reviewed at required widths in
light/dark/reduced-motion. Preserve `proto/` and integration entry points.

## 9. Validation and completion

Implementation common checks: `uv run mypy .`, `uv run pytest -v`,
`uv run ruff check .`, `git diff --check`, `npm --prefix web run check`,
`npm --prefix web run build`; after harness approval add
`npm --prefix web run test:e2e`. Each exits 0. Do not install missing packages
without explicit approval. Follow the three-failure circuit breaker in AGENTS.md.

Browser scenarios must assert user behavior and request payloads, not component
source strings. Synthetic API responses may test failure branches, but final
integration smoke uses a disposable local database and fake local gateway;
production data, credentials and dispatch stay untouched. Verify all C IDs and
keyboard/mobile cases against the integrated app before declaring the rebuild
complete. Physical touch-device QA must be recorded separately if unavailable;
emulation alone is not evidence of real-device testing.

For [02.17], deliver inventory, reconciled contract, proposal, dependency decision
and scoped task queue; keep status PLANNING until human approval. No implementation
or dependency install is authorized merely by this document's draft task list.
Release/tag, push, deployment and key rotation remain separate operator actions.

### Planning validation — 2026-11-08

- AST comparison: all 43 product API operations classified exactly once; document
  links, C01–C19 inventory and eight scoped task entries verified.
- Existing baseline: mypy (74 source files), Ruff, diff check, Svelte check
  (0 errors / 0 warnings) and Vite production build passed.
- Pytest: 234 passed, one existing Starlette/AnyIO deprecation warning. Sandboxed
  TestClient stalled and was interrupted; the authorized run outside the sandbox
  passed in 9.36 seconds, consistent with the existing NOTES troubleshooting entry.
- No frontend/backend source or manifest changed; no packages installed. Draft
  planning documents remain pending approval; task completion/commit and promotion
  follow the approval gate.

### Approval — 2026-11-08

Operator approved this plan, pt-BR/surface decisions, and the named dependency
changes with `proceed`. Earlier pending-approval statements describe the planning
gate at drafting time. Execute [02.18]–[02.25] sequentially; no repeated approval
is required within the approved scope. Extra dependencies remain separately gated.
