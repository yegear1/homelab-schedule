# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-11

### Added
- **SQLite WAL Job Store:** Persistent job notebook created on connect with `idx_jobs_due` index for instant due querying.
- **FastAPI HTTP Service:** `/health` and `/jobs` endpoints with `x-api-key` header authentication, supporting job creation, listing without payloads for memory savings, retrieval, immediate run (`POST /jobs/{id}/run`), and cancellation.
- **Asyncio Tick Loop:** Time-driven dispatching waking up on `asyncio.Event` or dynamic sleep based on `next_run_at`, featuring a 5-field cron walker for `America/Sao_Paulo` and catch-up dispatch.
- **WhatsApp Gatekeeper Dispatcher:** HTTP client sending canonical payloads (`phone_number`, `content`, optional `quote_id`) to the WhatsApp API gateway, recognizing `202 Accepted` as queued success.
- **Declarative Routine Loader (`routines.yaml`):** Startup merge of permanent routines by stable ID, protecting SQLite reminders and transitioning removed YAML IDs to paused.
- **MCP Stdio Server (`homelab-schedule-mcp`):** Four focused tools (`schedule`, `list_agenda`, `get_item`, `cancel`) communicating via local HTTP API without opening SQLite directly.
- **Docker Compose & Logging:** Multi-stage slim Dockerfile and Compose setup with standard library NDJSON logging compatible with VictoriaLogs / Vector.
- **Agent Skill:** `anotar-agenda` playbook guiding AI agents to annotate and manage schedule jobs using natural language.
