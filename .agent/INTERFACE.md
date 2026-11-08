# INTERFACE.md — UI Surface Contract

**Contract Status:** `Approved` — operator approved rebuild on 2026-11-08;
implemented surface verified through task [02.25]. Prior approval: 2026-09-12.
**Sources:** `src/homelab_schedule/*router.py`, `main.py`, `src/schemas/`,
`web/src/`, `tests/web/`, `.agent/ENDPOINTS.md`, `.agent/NOTES.md`.
**Plan and capability traceability:** [WEB_UI_REBUILD.md](WEB_UI_REBUILD.md).

## 1. Context and invariants

Single homelab operator; contacts do not log in. Product API requests require
`x-api-key` with the operator-supplied key; `/health` is public. Static SPA HTML
and assets are not protected product API resources. Do not use Bearer auth or
introduce accounts/OTP. Keep browser storage keys `SCHEDULE_API_KEY`,
`homelab_api_base_url`, `homelab_theme`; blank base URL means same origin.
The embedded key fallback was removed in [02.18]. Empty browser storage sends no key.
Fixtures use synthetic credentials only.

Server tick/services own scheduling, cron, rendering, dispatch and persistence.
Browser never calls gateway `/send`. Run `202` means accepted/queued, not delivered.
Manual run does not replace a future scheduled execution. Successful recovery of
an error job follows existing backend lifecycle rules.

YAML records are declarative: cancellation, rescheduling, pause/resume/snooze/retry
are unavailable through UI mutation; explain editing `routines.yaml`. Run-now
remains a separate backend-authorized action. Query `GET /jobs?to=` is the upper
DATE bound; `phone` filters destination OR creator. Create-body `to` is recipient.

## 2. Screen map

| ID | UI path | Observed baseline | Implemented destination |
|---|---|---|---|
| `scr-contacts` | `/contacts` | Directory/search/create | Rebuilt directory; same URL |
| `scr-contact` | `/contacts/{contactId}` | Identity/edit/scoped jobs/create/inspect | Shared composer/inspector in contact workspace |
| `scr-templates` | `/templates` | Catalog/search/editor/preview | Rebuilt catalog/editor; same URL |
| `scr-jobs` | `/jobs` | Agenda table/timeline/calendar, composer/inspector | Agenda with shared job components |
| `scr-history` | `/history` | No dedicated route; global attempts in agenda | Global attempts/status/limit, inspector and filtered CSV |
| `scr-data` | `/data` | No dedicated route; shell BackupModal | Snapshot/export/import/integrity with explicit replace dialog |

Keep `/` opening Contacts, browser history and direct links. Access dialog, theme
selector and notifications remain global. Existing backup entry points lead to
Data. No health/dashboard/settings-only screen is proposed.

## 3. Screen specifications and actions

### Contacts (`scr-contacts`, C04)

List `id/name/phone` from `GET /contacts`; local case-insensitive name/phone/ID
search, count, refresh and open detail. Create `POST /contacts` with required
`name` (1–80) and `phone` (1–64). `201` refreshes list; duplicate is `409`, invalid
fields `422`. Show loading, empty directory, no search match, error and ready.

### Contact (`scr-contact`, C05–C06)

Load `GET /contacts/{id}`; edit changed fields using PATCH (both fields optional,
same lengths as creation); unchanged submission makes no request. Confirm DELETE;
`204` returns to directory; `409` scheduled-job conflict keeps the contact.
`404` shows missing resource. Query jobs with `phone=contact.phone` and status
filter (initial upcoming). Phone change reloads jobs. Creator defaults to contact
phone; creation recipient is contact phone. Preserve template selection/clear,
create/inspect/cancel/reschedule/run with shared components. Proposed reuse may
expose the remaining existing agenda actions here without new API behavior.

### Templates (`scr-templates`, C07–C08)

Load/refresh `GET /templates`; local name/ID/body search and count. Required
create fields: `name` (1–80), `body` (min 1). PATCH fields optional; editor loads
selected template, resets/cancels edit, and displays name/body counters. Confirm
delete; referenced active-job `409` retains template with conflict alert. Success
is `201` create, `200` edit, `204` delete; missing item `404`; invalid input `422`.

Keep cursor insertion controls, unknown-placeholder warning and illustrative
live preview. Built-ins: `name`, `greeting`, `greeting_lower`, `saudacao`,
`saudacao_lower`, `period`, `date`, `date_iso`, `time`, `weekday`, `day_name`,
`month_name`, `year`, `day`, `month`, `hour`, `minute` inside `{{...}}`.
Unknown/custom tags remain literal in the sample. Backend renders at dispatch;
browser sample is not a guarantee of recipient/time-specific output. No Jinja.

### Agenda (`scr-jobs`, C09–C18)

- Filters: `status` (upcoming/done/paused/error/all), date `from/to`, `phone`,
  `limit` (1–100 when supplied; current UI 50), `tag`; reset, refresh and
  error-summary shortcut. Tag autocomplete uses `GET /jobs/tags`.
  Text `query` control is implemented; existing client/API support it already.
- List omits full content. Show title, recipient/contact alias, timing, kind,
  source/status, group, tags/variable count and errors. Counts derive from loaded
  records; do not label them as global aggregate metrics.
- Table groups `group_id` rows with member status summary; collapsed initially,
  expand individual/all groups, inspect member, and group actions. A filtered or
  limited member list must not be labelled the complete group.
- Timeline retains future/history/all modes, chronological ordering, refresh,
  attempt code/duration/status and inspect/actions. Current global history read
  requests 100; retention/list bounds apply.
- Calendar retains month previous/next/today, seven weekdays, selected-day detail,
  scheduled/attempt counts and error indicators. It displays loaded next runtimes
  and attempts, not all theoretical cron occurrences.
- Shared composer, inspector, lifecycle dialogs and downloads follow below.
  Changing view retains filters. Failures must not masquerade as empty results.

### Shared composer (`wdg-job-create`, C06/C10–C11)

| Field | Required | Constraint / binding |
|---|---|---|
| `title` | true | 1–120 characters |
| `kind` | true | once or cron |
| `run_at` | conditional | Required for once; ISO timestamp; UI converts selected browser-local instant to UTC |
| `cron_expr` | conditional | Required for cron; five fields; server validates meaning in configured TZ |
| `content` | conditional | Nonempty direct message XOR `template_id` |
| `template_id` | conditional | Selected catalog ID XOR `content`; missing template 404 |
| `to` / `recipients` | UI requires at least one | Single endpoint defaults `to=eu`; batch requires nonempty recipients array |
| `created_by` | false | Alias/contact/phone; contact page initializes contact phone |
| `variables` | false | String key/value map; add/replace/remove |
| `tags` | false | String list; trim/dedup/add/remove, autocomplete |
| `until` | false | ISO end date; once run cannot be later than until |
| `max_runs` | false | Positive integer when supplied |

Manual recipient chips accept aliases/numbers and comma/semicolon/space-separated
entries, dedup/removal and pending typed entry on submit. Contact picker supports
search and can target recipient or creator. One recipient → `POST /jobs`, many →
`POST /jobs/batch` returning group/count/jobs. `201` closes successful form and
refreshes affected lists. Invalid form sends no request; 401/404/422/network errors
retain inputs; disable duplicate submit. Preserve direct/template picker modes.

### Shared inspector and actions (C12–C15/C18)

`GET /jobs/{id}` supplies complete message, recipient/creator/template, source,
status, schedule timestamps, group, variables/tags, lifecycle limits/run count,
last error and retry count. Show group members from `GET /jobs?status=all&group_id=`
with bounded-result disclosure. Missing item is distinct from network failure.

| Action | Binding | Preconditions and success |
|---|---|---|
| Cancel | POST `/jobs/{id}/cancel` | SQLite; 204; refresh/clear missing selection |
| Reschedule | POST `/jobs/{id}/reschedule` | SQLite; `run_at` and/or `cron_expr` supplied, five-field cron; 200 Job |
| Run now | POST `/jobs/{id}/run` | Explicit user action; 202 queued; 502 gateway failure |
| Retry | POST `/jobs/{id}/retry` | SQLite error job; 200 Job; requeue differs from immediate run |
| Pause | POST `/jobs/{id}/pause` | SQLite scheduled; 200 Job; invalid state 409 |
| Resume | POST `/jobs/{id}/resume` | SQLite paused; 200 Job with recomputed next run |
| Snooze | POST `/jobs/{id}/snooze` | SQLite; UI submits future ISO `until`; preserves cron; 200 Job |
| Group actions | POST `/jobs/group/{group_id}/{action}` | action=cancel/run/retry/pause/resume/snooze; response group_id/affected/status; run 202, others 200 |

No group-reschedule endpoint exists. Use backend errors as authority for stale
state, invalid transitions and group eligibility. Common errors: 401 auth,
404 missing, 409 state/source conflict, 422 validation, run 502 gateway failure.
Snooze retains quick offsets and custom future date; API also accepts duration or
when but those are not existing UI controls.

Job history: `GET /jobs/{id}/runs?limit=20` currently, manual refresh, timestamp,
manual/scheduled trigger, status, code, duration and error; API limit 1–100.
Upcoming: `GET /jobs/{id}/upcoming?limit=5`, refresh, numbered local timestamps;
API limit 1–50, bounded by lifecycle and snooze. Empty projection is valid. Both
regions need independent loading/error/empty states. Switching selection must not
allow a stale response to overwrite the active job.

### History (`scr-history`, C16/C18)

Extract existing global attempt browsing while retaining Agenda timeline history.
Bind `GET /jobs/runs` (limit 1–100, default 50; UI may request 100), sorted latest
first. Status selector uses the existing success/error query; initial list limit is 50. Display
retention/limit scope; selecting attempt opens associated job inspector. Manual
refresh and retained-run CSV export remain available. CSV uses applied status and
omits list limit; unapplied drafts do not affect export.

### Data (`scr-data`, C19)

Four existing operations: SQLite snapshot (`GET /backup/database`), JSON export
(`GET /backup/export?include_runs=true|false`), JSON import
(`POST /backup/import`) and integrity (`GET /backup/integrity`).

Export defaults to include runs; data bundle contains metadata, contacts,
templates, SQLite jobs and runs; YAML excluded. Import reads selected file,
validates shape before sending, previews counts, chooses merge/replace, and
requires explicit replacement confirmation. Cancelling confirmation makes no
request. `mode` required; contacts/templates/jobs/job_runs arrays optional per
schema. Preserve returned created/updated/skipped summaries and warnings;
success clears the import draft; navigating to affected screens mounts fresh reads.
No cached list survives route teardown. Invalid JSON/schema/network/server errors
retain actionable feedback. Integrity shows both database and foreign-key checks,
details/violations. Downloads need authenticated requests and Blob cleanup.

## 4. Non-functional requirements

No UI polling, SSE, WebSocket, direct dispatch or invented retry. Reads refresh on
navigation, explicit refresh, saved access settings or successful mutation.
Never auto-replay failed mutations. Expose 401 access configuration, 404 missing,
409 domain conflict and 422 field validation separately from network errors.
Successful JSON must have JSON content type; 204 is bodyless. CSV validates
media type. HTML fallback must never be parsed as a successful API response.
Keep existing static HTML no-cache behavior and production same-origin serving.

All screens: loading/empty/error/ready; mutation busy and validation feedback;
list-filter no-match distinct from failed loading. Notifications announce status;
errors remain visible and retryable. No raw stack traces or fictitious telemetry.

## 5. Complete product API route classification

Paths use `{id}` as the normalized job/contact/template identifier. Each backend
product operation is classified once; consumers may reuse it across screens.

| Method | Path | Category | Consumer |
|---|---|---|---|
| GET | `/health` | ops-only | Public liveness; no screen |
| GET | `/health/metrics` | ops-only | HTTP/MCP aggregates; no browser caller |
| GET | `/jobs` | screen | Agenda/contact/group-members |
| POST | `/jobs` | action | Shared single composer |
| POST | `/jobs/batch` | action | Shared multi-recipient composer |
| POST | `/jobs/preview` | deferred | API/MCP dry run; no browser caller |
| GET | `/jobs/digest` | deferred | API/MCP digest; no browser caller |
| GET | `/jobs/tags` | widget | Filter/composer autocomplete |
| GET | `/jobs/export.csv` | widget | Agenda filtered download |
| GET | `/jobs/runs` | widget | Timeline/history |
| GET | `/jobs/runs/export.csv` | widget | Global/per-job history download |
| GET | `/jobs/{id}` | widget | Shared inspector |
| GET | `/jobs/{id}/runs` | widget | Inspector audit history |
| GET | `/jobs/{id}/upcoming` | widget | Inspector projection |
| POST | `/jobs/{id}/cancel` | action | Single cancellation |
| POST | `/jobs/{id}/reschedule` | action | Single reschedule |
| POST | `/jobs/{id}/run` | action | Single manual run |
| POST | `/jobs/{id}/retry` | action | Single requeue |
| POST | `/jobs/{id}/pause` | action | Single pause |
| POST | `/jobs/{id}/resume` | action | Single resume |
| POST | `/jobs/{id}/snooze` | action | Single snooze |
| POST | `/jobs/group/{group_id}/cancel` | action | Group cancellation |
| POST | `/jobs/group/{group_id}/run` | action | Group manual run |
| POST | `/jobs/group/{group_id}/retry` | action | Group requeue |
| POST | `/jobs/group/{group_id}/pause` | action | Group pause |
| POST | `/jobs/group/{group_id}/resume` | action | Group resume |
| POST | `/jobs/group/{group_id}/snooze` | action | Group snooze |
| GET | `/contacts` | screen | Directory/pickers |
| POST | `/contacts` | action | Directory creation |
| GET | `/contacts/{id}` | widget | Contact header |
| PATCH | `/contacts/{id}` | action | Contact edit |
| DELETE | `/contacts/{id}` | action | Contact deletion |
| GET | `/templates` | screen | Catalog/composer |
| POST | `/templates` | action | Template creation |
| GET | `/templates/{id}` | widget | Template resource; current editor also reuses list item |
| PATCH | `/templates/{id}` | action | Template edit |
| DELETE | `/templates/{id}` | action | Template deletion |
| GET | `/backup/database` | widget | Data snapshot download |
| GET | `/backup/export` | widget | Data JSON export |
| POST | `/backup/import` | action | Data merge/replace |
| GET | `/backup/integrity` | widget | Data integrity report |
| POST | `/routines/reload` | deferred | Operator maintenance outside UI |
| POST | `/housekeeping/purge` | deferred | Retention maintenance outside UI |

Infrastructure: `GET /`, `/favicon.ico`, mounted `/assets`, SPA fallback and
FastAPI documentation/OpenAPI are transport resources, not domain screens/actions.

## 6. Out of scope

Health dashboard/monitoring, direct `/send`, MCP stdio, YAML editing, new backend
routes, database schema changes, accounts/OTP/roles and new i18n locales.
No use of metrics endpoint to silently change loaded-list count semantics.

## 7. Deferred items

Preview/digest remain HTTP/MCP-only; reload/purge remain maintenance operations.
Browser adoption would need an explicit task, screen binding and acceptance tests.

## 8. Chrome configuration and approved surface

Preserve fixed `pt-BR`; no `Accept-Language` header. Themes light/system/dark,
default system, persisted locally with early first-paint application. Do not change
existing storage keys. Global access, notifications and theme controls remain.

Approved surface: Apple HIG archetype; opaque layered work surfaces,
restrained translucent shell; single-operator audience; compact/readable density;
plain pt-BR copy; responsive application; feedback-only motion. Token roles,
spacing/type/radii and responsive breakpoints are specified in plan §5. Preserve
RGB channel/alpha semantics and shared branding SVG. Text contrast ≥4.5:1,
focus/boundary contrast ≥3:1, ≥44 px targets, visible focus, 200% zoom, safe areas,
16 px input text. Reduced motion disables decorative movement. No hover-only
actions; topmost dialog traps/restores focus and handles Escape.

## 9. DOM anchors and states

Keep `<html data-theme="light|system|dark">`. Existing IDs below are compatibility
anchors and may move into shared components; never duplicate an ID in a rendered
screen. Preserve existing field names while moving forms. Full observed anchor
source is `web/src/` and the associated `tests/web/` before replacement.

| Surface | Required existing anchors / fields |
|---|---|
| Screens | `scr-contacts`, `scr-contact`, `scr-templates`, `scr-jobs` |
| Contacts | `wdg-contact-list`, `wdg-contact-create`, `wdg-contact-header`, `wdg-contact-edit`; fields name/phone |
| Templates | `wdg-template-list`, `wdg-template-form`, `wdg-template-pick`, `live-preview-box`, `unknown-tags-warning`; fields name/body/template_id |
| Jobs | `wdg-job-filters`, `wdg-job-list`, `wdg-job-detail`, `wdg-job-create`, `wdg-contact-pick`; status/from/to/phone/limit, title/content/kind/run_at/cron_expr/created_by/template_id |
| View selection | `view-mode-switcher`, `tab-view-table`, `tab-view-timeline`, `tab-view-calendar` |
| Timeline | `job-timeline-view`, `timeline-filter-all`, `timeline-filter-future`, `timeline-filter-history`, `timeline-future-section`, `timeline-history-section`, `btn-timeline-refresh-runs` |
| Calendar | `job-calendar-view`, `calendar-current-month`, `btn-calendar-today`, `btn-calendar-prev`, `btn-calendar-next`, `calendar-grid`, `calendar-day-detail` |
| Lifecycle | `modal-reschedule`, `modal-reschedule-run-at`, `modal-reschedule-cron`, `modal-snooze`, `modal-snooze-until`, `create-until`, `create-max-runs`, `detail-until`, `detail-runs`, `btn-detail-pause`, `btn-detail-resume`, `btn-detail-snooze` |
| Recovery/group | `detail-dead-letter-box`, `detail-dead-letter-error`, `detail-dead-letter-retries`, `btn-dead-letter-retry`, `btn-dead-letter-run-now`, `btn-detail-retry`, `btn-group-pause-all`, `btn-group-resume-all`, `btn-group-snooze-all`; preserve `data-group-id` |
| Variables/tags | `section-custom-variables`, `input-var-key`, `input-var-value`, `btn-add-var`, `detail-variables-card`, `section-tags`, `input-tag`, `btn-add-tag`, `filter-tag`, `tags-datalist`, `detail-tags-card` |
| Detail history/projection | `detail-runs-section`, `btn-refresh-runs`, `runs-loading`, `runs-empty`, `runs-list`, `detail-upcoming-card`, `btn-refresh-upcoming`, `upcoming-loading`, `upcoming-empty`, `upcoming-list` |
| Downloads/data | `btn-export-jobs-csv`, `btn-export-runs-csv`, `btn-export-job-runs-csv`, `btn-open-backup-modal-sidebar`, `btn-open-backup-modal-header`, `btn-download-sqlite`, `btn-export-json`, `input-import-file`, `btn-execute-import`, `btn-check-integrity` |
| Access/theme | `input-api-key`, `input-base-url`, `theme-btn-light`, `theme-btn-system`, `theme-btn-dark` |

Implemented additional screen roots: `scr-history`, `scr-data`. Interactive regions expose
`data-state=loading|empty|error|ready`; forms expose busy/error/ready as appropriate.
Use accessible names/roles to test behavior; source handler names/file layout are
not user-facing contracts. Additional test-supported anchors must be migrated
with the feature, not dropped silently.

## 10. CSV export actions

Agenda export uses current status/from/to/phone/tag and any applied query/group
filters; omit limit to download every match. Global history exports all retained
attempts, with status when selected; inspector export adds `job_id`. Requests use
`x-api-key`, validate CSV media type, create/revoke Blob URLs, disable busy actions,
announce completion and retain visible errors. Keep UTF-8 BOM, safe cells and
existing backend data meaning; JSON export remains the portability format.
