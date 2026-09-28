---
name: database-migration
description: Apply versioned SQLite schema migrations on connection using PRAGMA user_version and WAL mode, without Alembic or MCP DDL.
---

# SQLite Schema Migration (`database-migration`)

Canonical specification for evolving the SQLite database schema on connection in homelab-schedule.

## 1. Scope & Blast Radius

- **MUTABLE PATHS:** `src/homelab_schedule/db.py`, `src/schemas/**`, `tests/test_db*.py`.
- **IMMUTABLE PATHS:** Production SQLite database file (`data/schedule.db`), `.env`, secret configurations.
- **FORBIDDEN ACTIONS:**
  - MUST NOT execute DDL statements (CREATE, ALTER, DROP) through MCP tools.
  - MUST NOT install or introduce external migration tools (e.g., Alembic).
  - MUST NOT connect to SQLite without setting `PRAGMA journal_mode=WAL;`.
  - MUST NOT omit the composite index on `(status, enabled, next_run_at)` on the `jobs` table.
  - MUST NOT attempt `ALTER TABLE DROP COLUMN` without a full table rebuild (unsupported in legacy SQLite).

## 2. When to Use (Triggers)

The agent MUST activate this skill when:
- Adding, altering, or deprecating columns in SQLite tables (`jobs`, `contacts`, `templates`, `job_runs`).
- Creating new indexes to optimize queries for the tick loop or search filters.
- Implementing on-boot data backfills guarded by SQLite schema version increments.

The agent MUST NOT activate this skill when:
- Querying or mutating records via HTTP routes (activate `api-endpoint`).
- Operating scheduler tick loops (activate `due-tick`).
- Interacting with MCP agent tools (activate `mcp-tool`).

## 3. Required Tools & Prerequisites

- **Tools / MCPs:** `uv run pytest`, `sqlite3` CLI.
- **Pre-Conditions:** Existing connection logic located in `src/homelab_schedule/db.py`; `PRAGMA user_version` inspected.

## 4. Conflict Resolution & Precedence

Precedence order when rules conflict:
1. Security, Credentials & Blast Radius (No DDL via MCP, data integrity preserved)
2. Falsifiable Invariants & Automated Verification (Incremental migration on connect, index presence, tests pass)
3. Task Specifications & Performance (WAL mode, composite index for tick loop)
4. Style & Formatting Conventions (Explicit SQL uppercase keywords, idempotent DDL)

If an unresolvable rule conflict occurs, the agent MUST halt execution and request human clarification.

## 5. Operational Procedure

### Step 1: Pre-Flight Schema Inspection
1. Read current connection and schema initialization code in `src/homelab_schedule/db.py`.
2. Inspect current `PRAGMA user_version` value.
3. Verify that base tables (`jobs`, `contacts`, `templates`, `job_runs`) use `CREATE TABLE IF NOT EXISTS`.

### Step 2: Incremental Migration on Connect
1. Ensure connection initializes WAL journal mode: `PRAGMA journal_mode=WAL;`.
2. For schema changes, check `current_version = conn.execute("PRAGMA user_version").fetchone()[0]`:
   - If `current_version < N`: execute `ALTER TABLE ... ADD COLUMN ...` with default value or table rebuild.
   - Set `conn.execute(f"PRAGMA user_version = {N}")`.
3. Assert that required index `idx_jobs_due` on `jobs (status, enabled, next_run_at)` is present via `CREATE INDEX IF NOT EXISTS`.
4. Update corresponding Pydantic schemas in `src/schemas/` within the same atomic change.

### Step 3: Dual-Mode Boot Verification
1. Test clean initialization: Verify connection to a new, empty in-memory or temporary database creates the complete target schema at current version.
2. Test upgrade path: Verify connection to a simulated previous-version database applies migrations cleanly without data loss.
3. Execute test suite:
   ```bash
   uv run pytest tests/test_db.py -v
   ```

## 6. Fail-Stop & Escalation Protocol

- **Retry Limit:** If migration tests fail 2 consecutive times with the same error, STOP execution immediately.
- **Escalation Payload:** Report MUST state:
  1. Identified root cause (e.g., column already exists, syntax error in ALTER statement)
  2. Exact migration DDL and previous user_version
  3. Raw pytest error output
- **Forbidden Action:** The agent MUST NOT attempt undocumented ad-hoc workarounds or bypass safety checks once the retry limit is reached.

## 7. Git & Environment Safety

- **Forbidden Git Commands:** NEVER run `git push --force`, `git reset --hard`, or `git clean -fd` without explicit human instruction.
- **Secret Protection:** NEVER commit database binary files (`*.db`, `*.sqlite3`) or credentials to git.

## 8. Contrast Pairs

```python
// BAD: Unversioned inline ALTER TABLE failing on repeat runs
def init_db(conn):
    conn.execute("ALTER TABLE jobs ADD COLUMN until TEXT")

// GOOD: Idempotent versioned migration guarded by user_version
def migrate_schema(conn: sqlite3.Connection) -> None:
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    if version < 10:
        conn.execute("ALTER TABLE jobs ADD COLUMN until TEXT")
        conn.execute("PRAGMA user_version = 10")
```

## 9. Verification Checklist

- [ ] Command `uv run pytest tests/test_db.py -v` exits with status code 0
- [ ] Migrations execute inside Python connect handler without external CLI tools
- [ ] Composite index on `jobs (status, enabled, next_run_at)` created and verified
- [ ] Dual-path test passes: clean bootstrap and incremental upgrade
- [ ] Zero Alembic or third-party ORM migration dependencies introduced
