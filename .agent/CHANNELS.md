# CHANNELS.md — In-Repo Pens and Shared Notebook

The internal scheduler dispatches due jobs when `next_run_at <= now()` in UTC ([ADR-006](adr/006-tick-next-run.md)). Input surfaces ("pens") write to the database and signal `notebook_changed_event`.

Human interpretation timezone: `America/Sao_Paulo`. Logs, API parameters, and persisted `next_run_at`: UTC.

---

## 1. MCP (Model Context Protocol stdio)

Implementation in this repository: `uv run homelab-schedule-mcp` (stdio). Communicates with local HTTP daemon (`SCHEDULE_API_URL` and `SCHEDULE_API_KEY`). Never opens SQLite directly.

| Tool | Role |
| :--- | :--- |
| `schedule` | Creates a job. Parameters: `when` (ISO-8601, 5-field cron, relative intervals like `+15m`/`2h`/`in 10 minutes`, or natural language like `tomorrow 2pm`), `content`, `to` (default `eu`), optional `title`, optional `variables` (dictionary), optional `until` (ISO-8601 bound), optional `max_runs` (integer) |
| `list_agenda` | Compact summary: id, when, to, title, status (optional filters: `status`, `limit`, `to`, text `query`, and relative `period` like `today`, `tomorrow`, `this_week`, `7d`) |
| `get_item` | Single job details by ID: includes `content`, `source`, `variables`, `until`, `max_runs`, `run_count`, and `upcoming_runs` |
| `cancel` | Cancels a job by ID (SQLite only; YAML routines return explicit 409 error directing user to edit `routines.yaml`) |
| `pause` | Temporarily suspends a job (`status=paused`, `enabled=false`). YAML routines return error |
| `resume` | Re-enables a paused job (`status=scheduled`, `enabled=true`). YAML routines return error |
| `snooze` | Postpones the immediate next run (`next_run_at`) without modifying underlying cron schedule rule |
| `reschedule` | Modifies schedule time (`when`: ISO, cron, relative interval `+2h`, or friendly date) with same job ID |
| `preview` | Pure in-memory dry-run: resolves destination contact, computes `next_run_at` (UTC and local), renders template variables, validates lifecycle limits, and surfaces preventive conflict warnings |
| `daily_digest` | Morning synthesis: aggregates daily schedule, calculates totals, and detects overlapping conflicts ($\le 5$ min) for identical recipients |
| `upcoming_runs` | Deterministic projection of future occurrences in UTC and local timezone respecting lifecycle bounds |

Operator Skill: [`anotar-agenda`](skills/anotar-agenda/SKILL.md). Field Contract: [`agenda-job`](skills/agenda-job/SKILL.md).

---

## 2. HTTP API

Contract specification: [ENDPOINTS.md](ENDPOINTS.md). Header authentication: `x-api-key: {SCHEDULE_API_KEY}`. Primary ingestion channel for automation scripts, Web UI, and MCP.

---

## 3. Declarative YAML Routines (`ROUTINES_PATH`)

Permanent operational routines for homelab infrastructure. Version controlled via git; never instantiated from casual chats.

```yaml
# routines.yaml
- id: backup-status
  title: backup-status
  when: "0 9 * * 1"
  to: grupo-homelab
  content: "Backup status check for {{servidor}}."
  variables:
    servidor: "Proxmox Node 1"
```

- Stable string `id`: Key for merging. Editing the YAML entry updates the job; removing the ID disables the routine.
- `when`: 5-field cron expression in application timezone (`America/Sao_Paulo`). Do not define one-off jobs in YAML (dynamic one-off jobs belong in SQLite).
- `variables`: Optional static key-value dictionary for message interpolation.
- Loaded on container startup and reloaded on `st_mtime` change or `POST /routines/reload`.
- HTTP mutation (`DELETE /jobs/{id}`, `POST /jobs/{id}/cancel`) on YAML-sourced jobs returns `409 Conflict`.

External callers (chat bots, webhooks, alerting scripts) interact through the HTTP API. This repository does not implement chat command parsers or WhatsApp socket listeners.
