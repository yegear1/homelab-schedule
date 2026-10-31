# INTERFACE.md — UI Surface Contract

> Single source of truth for frontend implementation agents. If a screen or action is not declared here, it does not exist in the UI.
> Derived following the `ui-contract` skill. Technical stack definitions belong in ADRs, not in this specification file.
> Section 8 (Chrome) is mandatory even without a dedicated settings route.
> Dual backend and frontend copies MUST maintain identical contents across iterations.

**Contract Status:** `Approved` (2026-09-12 — 4-screen layout; user accounts/OTP omitted in current version)
**Backend:** `yegear1/homelab-schedule`  
**Base URL (dev):** `http://localhost:8003` (`APP_PORT` / env)  
**Last Derivation:** `2026-09-12` · Sources: `src/homelab_schedule/*_router.py`, `src/schemas/`, `.agent/ENDPOINTS.md`, `README.md`

---

## 1. Context

- **Actors:** Homelab operator (single user). External contacts do NOT authenticate against the UI.
- **Authentication:** Header — exact key name: `x-api-key: {SCHEDULE_API_KEY}`. Prohibit `Authorization: Bearer`. Only `GET /health` bypasses key verification.
- **Domain Invariants:** Single OS process / single SQLite database; scheduled dispatch is driven by server background tick (the UI never invokes `POST /send` directly). HTTP `202 Accepted` on run actions indicates gateway enqueued the message, not confirmed delivery. Jobs with `source: yaml` cannot be cancelled or rescheduled via HTTP API (must edit `routines.yaml`). Query parameter `to` on `GET /jobs` represents date range upper bound (`datetime`), NOT recipient phone number (recipient filtering uses `GET /jobs?phone=`).

---

## 2. Screen Map

| ID | UI Route | Purpose | Parent / Navigation |
| :--- | :--- | :--- | :--- |
| `scr-contacts` | `/contacts` | Contact directory (name + phone) | Navigation root |
| `scr-contact` | `/contacts/{contactId}` | Contact detail: edit info + filter jobs to/from phone | `scr-contacts` |
| `scr-templates` | `/templates` | Reusable message template catalog | Navigation |
| `scr-jobs` | `/jobs` | Global schedule overview (table/timeline/calendar + create + inspect) | Navigation |

---

## 3. Screen Specifications

### Screen `scr-contacts` — Contacts

- **UI Route:** `/contacts`
- **Purpose:** List and register contacts (name + phone). Clicking a row opens contact detail.
- **Widgets / Regions:**

| Region | Binding | Visible Fields | Mandatory in UI? |
| :--- | :--- | :--- | :---: |
| `wdg-contact-list` | `GET /contacts` → `{ contacts: Contact[] }` | `id`, `name`, `phone` | — (Read-only) |
| `wdg-contact-create` | Local form | `name`, `phone` | `name`: yes; `phone`: yes |

- **Actions:**

| Action | Binding | Precondition | Success | Error Mapping |
| :--- | :--- | :--- | :--- | :--- |
| Create contact | `POST /contacts` body `{ name, phone }` | `name` length 1–80; `phone` length 1–64 | `201 Created` Contact; refresh list | `401` → invalid/missing key; `422` → validation error; `409` → name/phone duplicate |
| Open detail | UI navigation | Click list item | Navigate to `scr-contact` | — |

- **States:**
  - `loading`: Awaiting list response
  - `empty`: `contacts` array is empty
  - `error`: Network or 5xx failure (`401` treated as auth failure)
  - `domain`: None beyond empty list
- **Hidden Fields:** SQLite storage path; literal value of `SCHEDULE_API_KEY`

---

### Screen `scr-contact` — Contact Details

- **UI Route:** `/contacts/{contactId}`
- **Purpose:** Inspect/edit contact details and display union of jobs whose destination or creator matches the contact's phone number.
- **Widgets / Regions:**

| Region | Binding | Visible Fields | Mandatory in UI? |
| :--- | :--- | :--- | :---: |
| `wdg-contact-header` | `GET /contacts/{id}` | `id`, `name`, `phone` | — |
| `wdg-contact-edit` | Form | `name`, `phone` (PATCH schema: both optional) | No (send changed fields only) |
| `wdg-job-list` | `GET /jobs?status=all&phone={phone}` | `JobListItem`: `id`, `title`, `to`, `target_number`, `kind`, `run_at`, `cron_expr`, `enabled`, `source`, `status`, `next_run_at`, `last_run_at`, `last_status`, `created_by`, `template_id` (omits `content`) | `phone` query parameter bound to contact |
| `wdg-job-detail` | `GET /jobs/{id}` | Complete job record including `content`, `last_error`, `retry_count` | On item selection |
| `wdg-job-create` | Form | `title`, `kind`, `run_at` (if once), `cron_expr` (if cron), `content` xor `template_id`, `to` (pre-filled), `created_by` (optional) | `title`, `kind`, timing parameter, `content` xor `template_id` |
| `wdg-template-pick` | `GET /templates` | `id`, `name` (picker dropdown) | No |

- **Actions:**

| Action | Binding | Precondition | Success | Error Mapping |
| :--- | :--- | :--- | :--- | :--- |
| Save contact | `PATCH /contacts/{id}` `{ name?, phone? }` | Contact loaded | `200 OK` Contact; reload jobs if phone changed | `401`; `404` → not found; `409` → duplicate; `422` |
| Delete contact | `DELETE /contacts/{id}` | Contact loaded | `204 No Content` → navigate to `scr-contacts` | `401`; `404`; `409` → scheduled jobs exist for this contact |
| Schedule job | `POST /jobs` | Valid form | `201 Created` Job; refresh `wdg-job-list` | `401`; `404` → missing template; `422` |
| View details | `GET /jobs/{id}` | Click job row | Populate `wdg-job-detail` | `401`; `404` → job not found |
| Cancel job | `POST /jobs/{id}/cancel` | `source='sqlite'` | `204 No Content`; refresh list | `401`; `404`; `409` → YAML jobs cannot be cancelled via HTTP |
| Reschedule | `POST /jobs/{id}/reschedule` `{ run_at }` or `{ cron_expr }` | `source='sqlite'` | `200 OK` Job | `401`; `404`; `409` YAML job; `422` invalid cron expression |
| Run now | `POST /jobs/{id}/run` | Explicit operator click | `202 Accepted` `{ status: 'queued', job_id }` | `401`; `404`; `502` → gateway rejected dispatch |

- **States:**
  - `loading`: Header and/or job list loading
  - `empty`: Zero jobs associated with this phone number
  - `error`: Network or server error
  - `domain`: Job status `scheduled` \| `done` \| `paused` \| `error`; source `yaml` vs `sqlite`
- **Hidden Fields:** Stack trace in `last_error`; raw `target_number` when contact name exists; internal `/send` payloads

---

### Screen `scr-templates` — Templates

- **UI Route:** `/templates`
- **Purpose:** CRUD management of reusable text templates. Runtime placeholders: `{{date}}`, `{{date_iso}}`, `{{time}}`, `{{weekday}}`, `{{day_name}}`, `{{month_name}}`, `{{year}}`, `{{name}}` (destination contact name). Unrecognized tags remain literal.
- **Widgets / Regions:**

| Region | Binding | Visible Fields | Mandatory in UI? |
| :--- | :--- | :--- | :---: |
| `wdg-template-list` | `GET /templates` → `{ templates }` | `id`, `name`, `body` | — |
| `wdg-template-form` | `GET /templates/{id}` on edit | `name`, `body` | Create: `name` yes, `body` yes; PATCH: optional |

- **Actions:**

| Action | Binding | Precondition | Success | Error Mapping |
| :--- | :--- | :--- | :--- | :--- |
| Create template | `POST /templates` `{ name, body }` | `name` length 1–80; `body` min length 1 | `201 Created`; refresh list | `401`; `422`; `409` → template name exists |
| Update template | `PATCH /templates/{id}` `{ name?, body? }` | Item selected | `200 OK`; update row | `401`; `404`; `409`; `422` |
| Delete template | `DELETE /templates/{id}` | Item selected | `204 No Content` | `401`; `404`; `409` → active jobs reference this template |

- **States:** `loading`, `empty`, `error`
- **Hidden Fields:** Jinja template directives (prohibited)

---

### Screen `scr-jobs` — Agenda Overview

- **UI Route:** `/jobs`
- **Purpose:** Global agenda view across all contacts; quick creation; detail inspection, cancel, reschedule, and manual trigger.
- **Widgets / Regions:**

| Region | Binding | Visible Fields | Mandatory in UI? |
| :--- | :--- | :--- | :---: |
| `wdg-job-filters` | `GET /jobs` query params | `status` (default `upcoming` \| `done` \| `paused` \| `error` \| `all`), `from`, `to`, `phone`, `limit` (1–100) | `status` optional (API default applied) |
| `wdg-job-list` | `GET /jobs` | `JobListItem` (omits `content`) | — |
| `wdg-job-detail` | `GET /jobs/{id}` | Complete job record | On selection |
| `wdg-job-create` | Form | Same fields as contact job form; default `to="eu"`; contact/template pickers | Mandatory fields matching job schema |
| `wdg-contact-pick` | `GET /contacts` | `id`, `name`, `phone` for `to` / `created_by` | No |

- **Actions:** Identical job actions as in `scr-contact` (`POST /jobs`, `GET /jobs/{id}`, cancel, reschedule, run).
- **States:** `loading`, `empty`, `error`, domain status badges.
- **Hidden Fields:** Full message `content` in list view; interpreting query `to` as recipient.

---

## 4. Non-Functional Requirements (NFRs)

| ID | Requirement | Verification Anchor |
| :--- | :--- | :--- |
| `nfr-auth` | All product endpoints require `x-api-key: {SCHEDULE_API_KEY}`; mismatch returns `401 Unauthorized` | `auth.py`, `ENDPOINTS.md` |
| `nfr-quota` | No rate-limiting headers (`429` / `Retry-After`) in this service | Source code audit |
| `nfr-offline` | Handled as standard network failure; no domain "device offline" states | Background tick operates on server |
| `nfr-poll` | No SSE/WebSocket polling; UI refreshes on user action or mutation | `api.ts` |
| `nfr-run` | `POST /jobs/{id}/run` returns `202 Accepted` on dispatch or `502 Bad Gateway` if outbound gateway fails | `jobs_router.py`, `ENDPOINTS.md`, ADR-004 |

---

## 5. Route Inventory

Every backend API endpoint is mapped exactly once:

| Method | Path | Category | Target (Screen ID / Action / —) |
| :---: | :--- | :--- | :--- |
| `GET` | `/health` | `ops-only` | Liveness probe (no UI screen) |
| `GET` | `/jobs` | `screen` | `scr-jobs` (`wdg-job-list`); also `wdg-job-list` in `scr-contact` |
| `POST` | `/jobs` | `action` | Create job in `scr-jobs` and `scr-contact` |
| `GET` | `/jobs/{id}` | `widget` | `wdg-job-detail` in `scr-jobs` and `scr-contact` |
| `POST` | `/jobs/{id}/cancel` | `action` | Cancel job in `scr-jobs` and `scr-contact` |
| `POST` | `/jobs/{id}/reschedule` | `action` | Reschedule job in `scr-jobs` and `scr-contact` |
| `POST` | `/jobs/{id}/run` | `action` | Manual dispatch trigger |
| `GET` | `/contacts` | `screen` | `scr-contacts`; contact picker in `scr-jobs` |
| `POST` | `/contacts` | `action` | Create contact in `scr-contacts` |
| `GET` | `/contacts/{id}` | `widget` | `wdg-contact-header` in `scr-contact` |
| `PATCH` | `/contacts/{id}` | `action` | Update contact in `scr-contact` |
| `DELETE` | `/contacts/{id}` | `action` | Delete contact in `scr-contact` |
| `GET` | `/templates` | `screen` | `scr-templates`; template picker in job forms |
| `POST` | `/templates` | `action` | Create template in `scr-templates` |
| `GET` | `/templates/{id}` | `widget` | `wdg-template-form` in `scr-templates` |
| `PATCH` | `/templates/{id}` | `action` | Update template in `scr-templates` |
| `DELETE` | `/templates/{id}` | `action` | Delete template in `scr-templates` |
| `POST` | `/routines/reload` | `deferred` | Admin maintenance endpoint |
| `POST` | `/housekeeping/purge` | `deferred` | Scheduled retention purge |

---

## 6. Out of Scope

- `GET /health` probe monitoring in UI.
- Direct outbound `POST /send` messaging calls (managed by scheduler tick).
- MCP agent stdio tools (consumed by Cursor/AI agents, not Web UI).
- In-browser editing of `routines.yaml`.
- Dedicated settings page solely for theme/locale toggles.
- User registration, OTP login, passwords, and multi-tenant authorization roles.

---

## 7. Deferred Items

- `POST /routines/reload`: Invoked via git hooks or CLI; no UI flow required.
- `POST /housekeeping/purge`: Automated by background tick loop.
- User accounts and authentication sessions (system uses operator `x-api-key`).

---

## 8. Chrome Configuration

Surface preferences applied across application shell:

### Theme (Mandatory)

| Field | Value |
| :--- | :--- |
| Options | `light` \| `system` \| `dark` (three modes) |
| Default | `system` (`prefers-color-scheme` with manual override) |
| Persistence | `localStorage` (client-side only) |
| Location | Global shell (header segmented control) |

### Locale (Mandatory)

| Field | Value |
| :--- | :--- |
| Policy | `fixed` |
| Active Locale | `pt-BR` (operator UI language agreed in task [00.4]) |
| Persistence | `local` |
| Request Header | Do NOT send `Accept-Language` (backend does not vary responses by language) |

---

## 9. DOM Anchors (Stack-Agnostic)

Implementations MUST preserve exact DOM IDs and `data-state` markers:

- Root Document: `<html data-theme="system">` (values: `light` \| `system` \| `dark`).

| Screen | Region / Widget | DOM `id` | Field `name` attributes | `data-state` values |
| :--- | :--- | :--- | :--- | :--- |
| `scr-contacts` | Page container | `scr-contacts` | — | `loading` \| `empty` \| `error` |
| `scr-contacts` | Contact list | `wdg-contact-list` | — | `loading` \| `empty` \| `error` |
| `scr-contacts` | Contact create form | `wdg-contact-create` | `name`, `phone` | `error` |
| `scr-contact` | Page container | `scr-contact` | — | `loading` \| `empty` \| `error` |
| `scr-contact` | Header widget | `wdg-contact-header` | — | `loading` \| `error` |
| `scr-contact` | Edit form | `wdg-contact-edit` | `name`, `phone` | `error` |
| `scr-contact` | Job list | `wdg-job-list` | `status`, `phone` (query) | `loading` \| `empty` \| `error` |
| `scr-contact` | Job detail drawer | `wdg-job-detail` | — | `loading` \| `empty` \| `error` |
| `scr-contact` | Create job form | `wdg-job-create` | `title`, `content`, `to`, `kind`, `run_at`, `cron_expr`, `created_by`, `template_id` | `error` |
| `scr-contact` | Template picker | `wdg-template-pick` | `template_id` | `loading` \| `empty` \| `error` |
| `scr-templates` | Page container | `scr-templates` | — | `loading` \| `empty` \| `error` |
| `scr-templates` | Template list | `wdg-template-list` | — | `loading` \| `empty` \| `error` |
| `scr-templates` | Template form | `wdg-template-form` | `name`, `body` | `error` |
| `scr-jobs` | Page container | `scr-jobs` | — | `loading` \| `empty` \| `error` |
| `scr-jobs` | Filter widget | `wdg-job-filters` | `status`, `from`, `to`, `phone`, `limit` | — |
| `scr-jobs` | Job list table | `wdg-job-list` | — | `loading` \| `empty` \| `error` |
| `scr-jobs` | Job detail drawer | `wdg-job-detail` | — | `loading` \| `empty` \| `error` |
| `scr-jobs` | Create job form | `wdg-job-create` | `title`, `content`, `to`, `kind`, `run_at`, `cron_expr`, `created_by`, `template_id` | `error` |
| `scr-jobs` | Contact picker | `wdg-contact-pick` | `to`, `created_by` | `loading` \| `empty` \| `error` |

## 10. CSV Export Actions

The agenda provides `btn-export-jobs-csv` (current status/date/phone/tag filters,
all matching jobs independent of list limit) and `btn-export-runs-csv` (all retained
execution history). The inspection drawer provides `btn-export-job-runs-csv` for
the selected job's complete history. These bind to `GET /jobs/export.csv` and
`GET /jobs/runs/export.csv` with optional `job_id`, respectively. Downloads use
`x-api-key`, validated CSV content type, Blob URLs with cleanup, disabled buttons
while busy, a status announcement, and visible alert messages on failure. Existing
DOM IDs, list/detail JSON endpoints, and scheduling actions remain unchanged.
