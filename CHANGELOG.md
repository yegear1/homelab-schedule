# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Contacts notebook (`GET/POST /contacts`, `GET/PATCH/DELETE /contacts/{id}`). Job `to` resolves contact id/name before env aliases.
- Job `created_by` and `GET /jobs?phone=` (union of destination or creator).
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
