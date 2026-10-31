# [ADR-002] SQLite WAL for Reminders and YAML for Permanent Routines

- **Status:** Approved
- **Date:** 2026-09-11
- **Author(s):** yegear / design session

---

## 1. Problem Context

The homelab scheduler manages two distinct classes of records: ephemeral/dynamic reminders ("tomorrow 2 PM: pay condo fee") and declarative permanent operational policies ("every Monday: backup status check"). Storing everything in SQLite obscures git history for infrastructure policies. Storing everything in YAML prevents MCP AI agents and dynamic API callers from securely recording one-off items without committing to git on every reminder.

## 2. Decision Taken

Segregate persistence into dual sources:

- **SQLite 3 WAL** (`DATABASE_PATH` on persistent volume): Stores dynamic jobs created via MCP or HTTP API (`source='sqlite'`).
- **`routines.yaml`** (`ROUTINES_PATH` mounted from repository or host): Stores declarative routines with stable string IDs; merged on application startup (`source='yaml'`).
- Schema management: Applied via versioned Python connection hooks on connect (`PRAGMA user_version`), without Alembic. One-off jobs (`schedule_type='once'`) transition to `status='done'` upon successful HTTP dispatch; recurring cron jobs update `next_run_at` to the next future timestamp.

## 3. Alternatives Considered

- **SQLite only:** Operational homelab routines disappear from git version control and cannot survive volume loss without database restores.
- **YAML only:** AI agent lacks a safe concurrency mechanism to record spontaneous reminders without committing git diffs continuously.
- **PostgreSQL:** Excessive memory and operational overhead for a local Mini PC with a single writer process.

## 4. Consequences and Trade-offs

### Positive

- Ephemeral reminders and permanent policies follow appropriate distinct lifecycles.
- Backup strategy is modular: volume snapshots for SQLite dynamic state, git commits for YAML routines.

### Negative / Accepted Risks

- YAML merge requires unique, stable IDs; ID collisions between SQLite and YAML must be rejected with HTTP 409.
- Runtime file watching: Relies on `st_mtime` tracking during tick loop plus explicit `POST /routines/reload` webhook trigger.
- HTTP cancellation of YAML-sourced jobs returns `409 Conflict` (requires direct editing of `routines.yaml`).

## 5. References and Links

- `.agent/CHANNELS.md`
- `.agent/skills/database-migration/SKILL.md`
