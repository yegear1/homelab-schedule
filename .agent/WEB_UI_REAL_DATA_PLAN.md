# Web UI Real-Data Remediation Plan

Status: Proposed; implementation requires operator approval. Scope: React UI, existing HTTP contracts, and behavior tests. No production mutation, new dependencies, API/schema changes, release, or deployment is authorized by this plan.

## Findings and coverage

| Surface | Observed issue | Task |
|---|---|---|
| Shared store and transport | Fixture-backed initial jobs, runs, contacts, templates and tags; failed reads retain them silently; mappings invent contact roles, timestamps and job metadata. | 02.33, 02.34, 02.35 |
| Jobs and groups | Failed create, run, lifecycle and group calls can simulate success locally; 202 is sometimes described as delivery. | 02.36 |
| Contacts and templates | Failed create/update may succeed only in memory; fabricated contact attributes and counts; create-template selection falls back to existing item. | 02.37 |
| Agenda, timeline and calendar | Calendar uses fixed dates and invented job distribution; timeline refresh is a toast, All duplicates upcoming; filters/counts must match bounded API data. | 02.38 |
| Inspector and history | History falls back to sample runs and local CSV; run payload/title may be inferred; history and projection need independent, race-safe states. | 02.39 |
| Data | SQLite fallback creates a fake database; JSON fallback uses browser state; integrity starts with invented values and reports success on errors; import contains a simulated success branch. | 02.40 |
| Shell and access | Public /health proves application liveness, not API-key validity or gateway connectivity; global navigation/actions and credential changes require end-to-end review. | 02.41 |
| Template preview | Explicit illustrative values are currently displayed as sample content. Keep only clearly labelled preview values; never use them as persisted or operational data. | 02.37 |
| Validation | Existing Playwright scenarios need verification against current React UI; source-string tests alone do not establish behavior. | 02.42 |

## Cross-cutting acceptance rules

- Start operational collections empty with explicit loading, empty, error and ready states. Never synthesize records, persistence, diagnostics, status, metrics, timestamps, payloads or downloads on failure. Stale real data, if retained, must be identified as stale and distinguishable from a successful refresh.
- Surface network and 401/404/409/422/server failures; retain drafts, avoid automatic retries and prevent duplicate submissions. Success follows the actual response only. A confirmed mutation followed by failed refresh must be reported separately, without prompting duplicate mutation.
- Use existing documented API, bounded lists and filters; counts describe their loaded scope. Do not invent delivery confirmation: 202 is gateway acceptance/queued. Keep YAML lifecycle restrictions and existing import replace confirmation.
- Keep illustrative template interpolation clearly labelled and isolated from actual data; unknown placeholders remain literal. Examples in input placeholders and test fixtures are permitted but must never enter operational state.
- Test failures as well as successful paths using isolated synthetic fixtures. Do not contact production or trigger real dispatch. Preserve pt-BR, accessibility, keyboard/focus, responsiveness, theme and reduced-motion contracts in `.agent/INTERFACE.md`.
- Each task includes meaningful regression tests, frontend check/build, relevant browser tests, canonical Python checks (`uv run pytest -v`, `uv run mypy .`, `uv run ruff check .`), `git diff --check`, an atomic conventional commit, and task/notes updates per AGENTS.md. Do not install dependencies without approval.

## Sequential atomic tasks

### [02.33] Establish behavior test foundation and inventory
- Map each visible screen, control, displayed field and API request to real source, bounds, error behavior and existing contract. Record gaps and resolve source/test drift in the plan; do not change product behavior.
- Verify current React Playwright harness and identify baseline failures, distinguishing obsolete Svelte assertions from product regressions. Add targeted failing-regression specifications as the implementation tasks are performed; no skipped tests counted as coverage.
- Acceptance: reproducible baseline and complete screen/action traceability, including direct routes, global controls, 401/network/409 and failed reads/writes. No network to production.

### [02.34] Remove fabricated operational state and correct domain mappings
- Initialize jobs, runs, contacts, templates and tags without fixtures; use explicit resource state and propagate errors. Remove invented role, timestamps, retry limits, status codes and other unsupported API fields or mark unavailable; do not infer rendered messages.
- Acceptance: cold start and failed/empty reads never show examples as real records; real responses replace data, failures are visible, stale responses cannot overwrite newer requests, and unavailable fields are not presented as facts.

### [02.35] Bind authenticated reads, filters and exports
- Align agenda and catalog reads with documented request parameters, scoped contact queries, bounded results and refresh behavior; make filters and CSV use the same applied server-side scope. Remove all local CSV fallback generation.
- Acceptance: exact query/auth verified, errors distinguish empty from failed, CSV is generated only from valid server response, failed export creates no download, and displayed counts disclose loaded scope.

### [02.36] Make job and group mutations authoritative
- Remove all local success fallbacks for creation, run, cancel, reschedule, retry, pause, resume, snooze and group actions. Use response status and refresh separately; preserve drafts and YAML restrictions.
- Acceptance: success changes only follow server acceptance; 401/409/422/network errors produce no false success or fabricated run; 202 means queued, not delivered; duplicate submission and automatic replay are prevented, including when post-write refresh fails.

### [02.37] Correct contact and template workflows
- Bind CRUD and scoped contact jobs to actual resources; propagate 409/validation/network failures, preserve drafts, fix new-template selection and expose only supported contact fields. Keep preview explicitly illustrative and unknown variables literal.
- Acceptance: CRUD survives reload on success, conflict leaves record and draft intact, failed write changes no displayed persisted data, contact job filtering uses documented phone semantics, and samples never become stored values.

### [02.38] Restore real agenda views and controls
- Implement table/timeline/calendar from bounded real jobs and runs. Calendar uses actual dates and month navigation, shows loaded next runs and attempts without inventing recurring occurrences; timeline All/future/history and refresh perform their advertised actions.
- Acceptance: known dates, empty/error history, navigation across months and leap years, keyboard interaction, sort order and bounded-data labels are tested; no synthetic distribution, static today or false refresh notification.

### [02.39] Make inspector and execution history authoritative
- Load detail, per-job runs, upcoming projection and global history independently from API; guard selection races, distinguish errors and remove fabricated payload/recipient/status and sample fallback. Reuse authoritative lifecycle and CSV behavior.
- Acceptance: errors do not render as empty/success, stale responses cannot replace current selection, missing detail is distinct, attempts display only returned information, and history export failure does not produce a file.

### [02.40] Secure data operations and integrity display
- Remove fake SQLite and JSON downloads and simulated import branch. Display only actual integrity response fields; no initial pass state or fabricated WAL metrics. Validate import structure, preserve failed draft and guard replace confirmation; surface actual summary and warnings.
- Acceptance: failed or invalid downloads create no file; failed integrity never reports pass; failed/cancelled import makes no successful claim or local mutation; valid merge/replace produces only server-reported results in an isolated database.

### [02.41] Align shell, navigation and access feedback
- Audit every global control, direct route, command palette action, access change and theme control. Describe public health as application liveness only; validate authentication separately using an existing authenticated endpoint if presenting credential status. Refresh relevant reads when settings change.
- Acceptance: no claim of gateway health or valid credentials based solely on `/health`; navigation and actions work from each route, auth errors are actionable, and keyboard/focus and responsive behavior are verified.

### [02.42] End-to-end production readiness verification
- Run React behavior suites against isolated FastAPI/SQLite and fake gateway with synthetic credentials; validate CRUD, scheduling, queue acceptance, failure paths, history, filters, import/export and integrity. Reconcile contract/test drift and remove unused operational fixtures/mock pathways without removing test-only fixtures.
- Acceptance: required checks pass; tests cover offline, auth, server errors and failed post-write refresh with no false data or downloads; review accessibility, mobile widths, zoom, reduced motion and direct navigation. Record residual limitations and evidence. This establishes UI readiness against the tested environment, not production deployment or real delivery.

## [02.33] React inventory and baseline (2026-11-09)

This is a source audit, not a claim that every control has passed a browser test. The current contract is `.agent/INTERFACE.md` sections 2–5 and 9–10. The implementation differs from it in material ways. Audit each control's keyboard, loading, failure and success behavior during its assigned task.

| Area and controls | Data source or current behavior | Gaps and verification owner |
|---|---|---|
| Shell, direct routes, navigation, theme, palette, access, global create | `App.tsx`, `AppShell.tsx`, `CommandPalette.tsx`, `AccessDialog.tsx`; `/health`, browser settings, shared store | `/` opens agenda although contract says contacts; contact selection and deep links need checking; `/health` is public and cannot establish authentication/gateway readiness. Test navigation, back/forward, credential changes, actions from all routes, focus and theme in 02.41. |
| Contacts: search/select/create/edit/delete, scoped jobs and create/inspect | `/contacts` CRUD, jobs store and shared composer/inspector | Read/write fallback and invented role/timestamps; job counts depend on current loaded jobs rather than a scoped query. Verify 401/404/409/422, edits and deletion, direct links and phone filtering in 02.34–02.37. |
| Templates: search/select/new/edit/delete, token insertion and preview | `/templates` CRUD and client sample interpolation | Local fallback on failed writes, selected-item fallback can prevent new draft; verify 409, draft retention and 17 tokens, keep preview clearly illustrative in 02.37. |
| Agenda: filters, counts, table/group controls, create and CSV | `/jobs`, `/jobs/tags`, `/jobs/batch`, group/lifecycle endpoints and `/jobs/export.csv` | Fetch currently requests `status=all`, filters locally, and CSV constructs server query independently; fixture state and local mutation/export fallback. Verify bounded results, exact filter/export equivalence, all single/group actions and errors in 02.34–02.36. |
| Composer: schedule type/time/cron, recipients, direct/template, variables/tags/limits | Single/batch creation; contacts/templates/tags catalogs | Verify exact payload, browser-local conversion, validation, busy state and draft preservation; failed requests must never create local jobs. 02.36. |
| Timeline/calendar: tabs, refresh, day/month selection and inspection | Loaded jobs and store runs | Timeline refresh is a toast and All selects upcoming; calendar is fixed to November 2026 with synthetic placement and inactive month arrows. Verify real dates, attempt errors and bounds in 02.38. |
| Inspector: details, run history, upcoming, lifecycle, group and exports | `/jobs/{id}`, `/runs`, `/upcoming`, mutation routes | Independent reads and race/error states need verification; local mutation fallbacks and fabricated mappings undermine results. Verify status semantics, YAML restrictions, missing data and CSV in 02.36/02.39. |
| History: status/limit, refresh, detail, rerun and CSV | `/jobs/runs`, `/jobs/runs/export.csv`, shared store | Sample runs and local export on failures, derived payload/recipient, fixed retention and gateway status. Verify real data and no false feedback in 02.39. |
| Data: integrity, SQLite and JSON export, import merge/replace | `/backup/integrity`, `/backup/database`, `/backup/export`, `/backup/import` | Fake snapshot and local export fallbacks, fabricated diagnostics and simulated import branch; page also says all invariants verified unconditionally. Verify response types, no downloads on failure, replace confirmation and actual summary in 02.40. |

### Browser baseline

`npm --prefix web run test:e2e` passed its TypeScript configuration check and launched the isolated fixture and React app. Four agenda tests failed at their common setup: `locator('#scr-jobs')` was absent, so the expected `data-state=ready` could not be observed. The run was manually interrupted after these four failures; two tests were interrupted and 145 were not run. This is a single failed suite invocation, not a complete 151-test result. The missing anchor is both an implementation/contract regression and test migration drift; do not weaken the behavior expectations solely to make tests pass. The legacy test names alone are not evidence that React behavior works. The suite must be reconciled incrementally alongside 02.34–02.41 and run in full at 02.42.
