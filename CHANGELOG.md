# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-09-22

### Added
- **CI/CD GHCR:** GitHub Actions workflow builds, caches (BuildKit `gha`), and publishes multi-stage Docker image to `ghcr.io/yegear1/homelab-schedule` on `main` push, SemVer tags, and `workflow_dispatch`.
- **Advanced Job Lifecycle (`until`, `max_runs`, pause/resume, snooze):** Recurrent jobs auto-stop on expiry date or execution quota; `pause`/`resume` endpoints suspend/reactivate without data loss; `snooze` postpones the next fire without mutating `cron_expr`. Group-level variants for all three actions.
- **Operator Dead-Letter Alerts:** Critical gateway failures (permanent HTTP error or retries exhausted) notify the operator via `WHATSAPP_ADMIN_NUMBER` without side-effects on the scheduler loop.
- **Custom Job Variables (`variables: dict[str, str]`):** Arbitrary key-value pairs on each job, persisted as JSON, safely interpolated in templates; supported across HTTP API, MCP `schedule`/`preview`, `routines.yaml`, web UI, and backup export/import.
- **SQLite Backup & Portability:** Online `GET /backup/database` (binary snapshot), structured `GET /backup/export` (JSON bundle), atomic `POST /backup/import` (merge or replace), and `GET /backup/integrity` audit endpoint; operator `BackupModal.svelte` with four action tabs.
- **Calendar & Timeline UI Views:** Segmented view switcher on the jobs list — classic table, vertical chronological timeline (upcoming + history with relative timestamps), and interactive monthly calendar with daily event chips.
- **Execution History (`job_runs`):** Persistent audit log of every dispatch attempt (trigger, status, HTTP code, duration in ms, error message) with `GET /jobs/{id}/runs` and `GET /jobs/runs`; displayed in the job detail drawer.
- **Dead-Letter Retry:** `POST /jobs/{id}/retry` and `POST /jobs/group/{group_id}/retry` requeue error jobs; `GET /jobs` now includes `last_error` and `retry_count`; operator UI shows dead-letter banner with retry and run-now actions.
- **Contextual Greetings & Dynamic Template Tags:** `{{greeting}}`, `{{greeting_lower}}`, `{{saudacao}}`, `{{period}}`, `{{day}}`, `{{month}}`, `{{hour}}`, `{{minute}}` resolved at dispatch time in `America/Sao_Paulo`.
- **MCP `preview` Tool (dry-run):** Resolves recipient, calculates `next_run_at`, renders all template variables in memory without touching SQLite or the gateway.
- **Advanced MCP Filters (`list_agenda`):** New optional params `to` (alias/phone), `query` (full-text search on title/content), and `period` (relative window: `hoje`, `esta semana`, `próximos 7 dias`, ISO date ranges).

### Changed
- `docker-compose.yml` hardened with `security_opt: no-new-privileges`, liveness `healthcheck` on `GET /health`, and `deploy.resources` limits (0.5 CPU / 256 MB RAM).

## [0.3.0] - 2026-09-19

### Added
- **Svelte 5 Operator Web UI (`web/`):** SPA operator interface served directly by FastAPI via `StaticFiles` with SPA fallback, built via multi-stage Docker (`node:22-alpine` -> `python:3.13-slim`).
- **Grouped Batch Messages:** Collapsible visual clustering of batch jobs sharing `group_id` with batch run and cancel actions on the master row.
- **Batch Jobs & Dispatch Groups:** `POST /jobs/batch` for multi-recipient jobs with indexed `group_id` in SQLite schema v7, and group management endpoints (`POST /jobs/group/{group_id}/run` and `cancel`).
- **Contacts Notebook:** SQLite contacts CRUD (`GET/POST /contacts`, `GET/PATCH/DELETE /contacts/{id}`) with resolution of job `to` field before environment aliases.
- **Message Template Catalog:** Catalog CRUD (`GET/POST /templates`, `GET/PATCH/DELETE /templates/{id}`) and dynamic `{{name}}` interpolation merged with temporal clock tags.
- **Creator Tracking:** `created_by` field on jobs and `GET /jobs?phone=` querying jobs by either destination or creator.
- **Friendly MCP Expressions (`when`):** Natural language calendar formats (`amanhã 14h`, `hoje 18:00`, `segunda 9h`) and relative intervals (`+15m`, `2h`, `em 10 minutos`, `1h30m`) in `parse_when` for MCP `schedule` and `reschedule`.
- **Accessibility & Quality Fixes:** Focus trapping in modals/drawers (`focusTrap.ts`), RFC 7234 heuristic cache prevention headers, strict RGB slash alpha theme styling (light/system/dark), and responsive table layouts.

## [0.2.0] - 2026-09-12

### Added
- Persist normalized `target_number` on each job so the tick does not re-resolve aliases at fire time; document a gateway-agnostic `Dispatcher`.
- `reschedule` / snooze for one-off sqlite jobs (`POST /jobs/{id}/reschedule` and MCP `reschedule`), keeping a stable id.
- Live `routines.yaml` reload via `POST /routines/reload` and tick `mtime` watch.
- Automatic SQLite housekeeping (`JOB_RETENTION_DAYS`, default 365) plus `POST /housekeeping/purge`.
- MCP/HTTP list filters: `status=error` and defensive `limit`.
- Temporal message placeholders at dispatch (`{{date}}`, `{{time}}`, `{{day_name}}`, and related tags).
- Transient gateway retries with exponential backoff (up to 3 attempts) before marking a job as `error`.

### Changed
- HTTP default port is `8003` (Compose, Dockerfile, MCP `SCHEDULE_API_URL`).

## [0.1.0] - 2026-09-11

### Added
- **SQLite WAL Job Store:** Persistent job notebook created on connect with `idx_jobs_due` index for instant due querying.
- **FastAPI HTTP Service:** `/health` and `/jobs` endpoints with `x-api-key` header authentication, supporting job creation, listing without payloads for memory savings, retrieval, immediate run (`POST /jobs/{id}/run`), and cancellation.
- **Asyncio Tick Loop:** Time-driven dispatching waking up on `asyncio.Event` or dynamic sleep based on `next_run_at`, featuring a 5-field cron walker for `America/Sao_Paulo` and catch-up dispatch.
- **HTTP send dispatcher:** client posting canonical payloads (`phone_number`, `content`, optional `quote_id`) to `{WHATSAPP_API_URL}/send`, treating `202 Accepted` as queued success.
- **Declarative Routine Loader (`routines.yaml`):** Startup merge of permanent routines by stable ID, protecting SQLite reminders and transitioning removed YAML IDs to paused.
- **MCP Stdio Server (`homelab-schedule-mcp`):** Four focused tools (`schedule`, `list_agenda`, `get_item`, `cancel`) communicating via local HTTP API without opening SQLite directly.
- **Docker Compose & Logging:** Multi-stage slim Dockerfile and Compose setup with standard library NDJSON logging compatible with VictoriaLogs / Vector.
- **Agent Skill:** `anotar-agenda` playbook guiding AI agents to annotate and manage schedule jobs using natural language.
