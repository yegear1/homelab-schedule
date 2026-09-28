**English** | [Português (Brasil)](./README.pt-br.md)

---

# homelab-schedule

Lightweight agenda in a single container: **one-off** and **recurrent** jobs that trigger `POST /send` on a configurable HTTP gateway at their scheduled time. Version **0.4.0** (`homelab-schedule-mcp`). Notes: [CHANGELOG](./CHANGELOG.md) · [GitHub Release](https://github.com/yegear1/homelab-schedule/releases/tag/v0.4.0).

This repository does **not** include a WhatsApp client, a chat bot, or an anti-ban queue. It strictly handles scheduling and dispatching. Any service that accepts the payload below works as a dispatch gateway (`202` = accepted into the queue). This service does not poll and does not immediately re-dispatch. Transient failures (network errors, 5xx) retry up to 3 times with exponential backoff; 401/422 status codes immediately mark the job as `error`.

## Pens (Shared Notebook)

| Interface | Consumers | In this repo |
| :--- | :--- | :--- |
| **Web UI** (`/`, `/contacts`, `/templates`, `/jobs`) | Browser operator interface (Svelte 5: table, timeline, calendar, and backup) | Yes |
| **MCP** (`schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`, `pause`, `resume`, `snooze`, `preview`) | Cursor / AI agents | Yes |
| **HTTP** (`/jobs`, `/contacts`, `/templates`, `/backup`, `/health`, `/routines/reload`, `/housekeeping/purge`) | Scripts, MCP, and external callers | Yes |
| **YAML** (`routines.yaml`) | Permanent routines (reloaded on mtime change or `POST /routines/reload`) | Yes |

You can schedule using natural language expressions (*“tomorrow 2pm, pay rent”* or *“+15m”*). Destinations: contact (name or ID), alias in `WHATSAPP_ALIASES`, or raw phone number. On job creation, the server persists `target_number`, and the tick dispatches to this resolved value.

## Stack

- Python 3.13+, UV, FastAPI, sqlite3 WAL, `next_run_at` tick (no APScheduler/Alembic)
- Single process: HTTP API + integrated scheduler
- NDJSON logs (VictoriaLogs / Vector)
- Homelab Compose; `TZ=America/Sao_Paulo`; default HTTP port **8003**

Details for agents: [`AGENTS.md`](./AGENTS.md), [`.agent/NOTES.md`](./.agent/NOTES.md), [`.agent/TASK.md`](./.agent/TASK.md). HTTP contract: [`.agent/ENDPOINTS.md`](./.agent/ENDPOINTS.md).

## Development

```bash
cp .env.example .env
uv sync
uv run pytest -v
uv run ruff check .
uv run mypy .
uv run uvicorn homelab_schedule.main:create_app --factory --reload --port 8003
```

Compose:

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f
```

SQLite persists in the `schedule-data` volume. Secrets belong in `.env`, not in YAML. `WHATSAPP_API_URL` is the URL **of the dispatch gateway** (historical variable name; does not imply a specific repository) and must be reachable from the container. API authentication: header `x-api-key` = `SCHEDULE_API_KEY` (except `GET /health`).

## MCP (Cursor & Agents)

Do not commit `.cursor/mcp.json`. With the API running:

```bash
uv run homelab-schedule-mcp
```

In local `mcp.json`, `command`/`args` point to this script (`uv run --directory <repo> homelab-schedule-mcp`) with `SCHEDULE_API_URL` and `SCHEDULE_API_KEY` in the server's `env`. MCP strictly wraps the HTTP API and never queries SQLite directly.

Available MCP tools:
- `schedule`: create one-off or recurrent schedules (`when`, `to`, `content`, `variables`, `until`, `max_runs`).
- `list_agenda`: query jobs by status (`upcoming`, `done`, `error`, `paused`, `all`), relative window (`period`), query search (`query`), and recipient (`to`).
- `get_item`: inspect full job details by `id`.
- `cancel`: cancel a scheduled job in SQLite.
- `reschedule`: update `run_at` or `cron_expr` of a scheduled job.
- `pause` / `resume`: temporarily suspend or reactivate a job.
- `snooze`: postpone the next fire time without mutating the master cron rule.
- `preview`: in-memory dry-run calculating fire times, resolving recipients, and rendering template variables.

## HTTP API Summary

- **Jobs:**
  - List: `GET /jobs?status=upcoming|done|error|paused|all&limit=…&phone=…&query=…`. Query `to` specifies the **end of a date range**. `phone` matches destination or creator.
  - Detail: `GET /jobs/{id}` (includes `content`, `target_number`, `variables`, `until`, `max_runs`).
  - Create / Cancel / Run now: `POST /jobs`, `POST /jobs/{id}/cancel`, `POST /jobs/{id}/run` (`run` triggers immediately without modifying the schedule).
  - Batch: `POST /jobs/batch`, `POST /jobs/group/{group_id}/cancel`, `POST /jobs/group/{group_id}/run`.
  - Lifecycle: `POST /jobs/{id}/reschedule`, `POST /jobs/{id}/pause`, `POST /jobs/{id}/resume`, `POST /jobs/{id}/snooze`, `POST /jobs/{id}/retry`.
  - Execution History: `GET /jobs/{id}/runs`, `GET /jobs/runs`.
  - Dry-Run Preview: `POST /jobs/preview`.
- **Contacts:** `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/{id}` (DELETE returns `409` if a `scheduled` job references the phone number).
- **Templates:** `GET/POST /templates`, `GET/PATCH/DELETE /templates/{id}` (DELETE returns `409` if a `scheduled` job references the `template_id`). `POST /jobs` accepts `template_id` **or** `content`.
- **Backup & Integrity:** `GET /backup/database` (SQLite WAL snapshot), `GET /backup/export` (JSON bundle), `POST /backup/import` (merge or replace), `GET /backup/integrity`.
- **Routines & Maintenance:** `POST /routines/reload`, `POST /housekeeping/purge`.

## Dispatch Gateway

During tick execution (and on `POST /jobs/{id}/run`), the service calls:

`POST {WHATSAPP_API_URL}/send`

| Item | Value |
| :--- | :--- |
| Header | `x-api-key: {WHATSAPP_API_KEY}` |
| JSON | `phone_number`, `content` (optionally `quote_id`) |
| Success | **`202 Accepted`** — message accepted by the gateway; does not imply delivery to recipient |

`phone_number` is the job's `target_number` (E.164, chat ID, or whatever your gateway expects). A WhatsApp backend is an example use case, not a direct dependency of this project.

## Housekeeping & Retention

- **Automatic daily purge:** the tick removes `done`/`error` jobs where `source = sqlite` older than `JOB_RETENTION_DAYS` (default 365; `0` disables) and purges old `job_runs` records.
- **Manual purge:** `POST /housekeeping/purge?days=365` (`x-api-key`). Jobs with status `scheduled` and `yaml` routines are preserved.
- **Dead-Letter alerts:** terminal gateway errors or exhausted retries notify the operator via `WHATSAPP_ADMIN_NUMBER`.

## Dynamic Message Templates

At dispatch time, date/time placeholders in `content` are interpolated in the configured `TZ` (default `America/Sao_Paulo`). The text stored in the job or YAML is **not** rewritten — `cron` routines re-interpolate on each cycle.

| Placeholder | Example | Description |
| :--- | :--- | :--- |
| `{{date}}` | `11/09/2026` | Date formatted as `DD/MM/YYYY` |
| `{{date_iso}}` | `2026-09-11` | Date formatted as `YYYY-MM-DD` |
| `{{time}}` | `08:00` | Time formatted as `HH:MM` |
| `{{weekday}}` | `sex` | Short weekday name (Portuguese) |
| `{{day_name}}` | `sexta-feira` | Full weekday name |
| `{{month_name}}` | `setembro` | Full month name |
| `{{year}}` | `2026` | 4-digit year |
| `{{day}}` | `11` | 2-digit day of the month |
| `{{month}}` | `09` | 2-digit month |
| `{{hour}}` | `08` | 2-digit hour |
| `{{minute}}` | `00` | 2-digit minute |
| `{{greeting}}` | `Bom dia` | Contextual greeting based on local time |
| `{{greeting_lower}}` | `bom dia` | Contextual greeting in lowercase |
| `{{saudacao}}` | `Bom dia` | Alias for greeting |
| `{{period}}` | `manhã` | Period of the day (`manhã`, `tarde`, `noite`) |
| `{{name}}` | `Maria` | Destination contact name registered in the notebook |
| `{{your_variable}}` | `12345` | Custom variable defined in the job's `variables` dictionary |

Jobs can reference a persisted `template_id` (`/templates`) or contain inline content. At dispatch time, `{{name}}` and custom variables are merged alongside temporal placeholders.

## Repository

GitHub: [`yegear1/homelab-schedule`](https://github.com/yegear1/homelab-schedule).
