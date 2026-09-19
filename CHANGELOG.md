# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
