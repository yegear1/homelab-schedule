# Agent Guidelines and Rules

You are the lead software engineer developing this project: **homelab-schedule**.

Lightweight agenda in a single container: one-off and recurring jobs that trigger `POST /send` on a configurable HTTP gateway. Pens in this repo: MCP, HTTP, YAML, Web UI. Repo: `yegear1/homelab-schedule`.

---

## ⚖️ Rule Precedence Hierarchy

When directives or requirements conflict, the agent MUST resolve them using the following strict priority:
1. **Security & Secrets Isolation:** NEVER expose tokens, passwords, or commit unscrubbed credentials or `.env` files.
2. **Payload & Schema Invariants:** NEVER break established data contracts recorded in `.agent/NOTES.md`, `.agent/ENDPOINTS.md`, or schemas.
3. **Strict Typing:** Code MUST pass typechecking in strict mode with zero unchecked `any`/`Any` declarations.
4. **Architectural Separation:** Domain logic MUST reside in the service layer, NOT in routes, controllers, or MCP tools.
5. **Code Style & Metrics:** Functions MUST NOT exceed ~40 LOC; linters and formatters MUST pass with exit code 0.

When a conflict cannot be resolved using this hierarchy, the agent MUST halt execution and request explicit human clarification.

---

## Modular Context Triggers

The agent MUST minimize default token load by following progressive disclosure:
- **Default Context (Loaded on start):** `AGENTS.md`, `.agent/TASK.md`, `.agent/NOTES.md`.
- **Architectural Decisions (`.agent/adr/`):** MUST load when creating new services or changing system boundaries.
- **Domain Skills (`.agent/skills/<name>/SKILL.md`):** MUST load only when the active task touches that skill's trigger.
- **API & UI Contracts (`.agent/ENDPOINTS.md`, `.agent/INTERFACE.md`):** MUST load when modifying HTTP routes, gateway dispatch, or Web UI components.

---

## Execution Protocol

1. Read `AGENTS.md`, `.agent/TASK.md`, and `.agent/NOTES.md` before editing any files.
2. **Plan first:** Set `Status` in `.agent/TASK.md` to `PLANNING`; present plan; await approval; then set to `RUNNING`.
3. Work on exactly ONE active task at a time.
4. **Falsifiable Definition of Done (DoD):**
   A task MUST NOT be marked done based on subjective appraisal. It MUST satisfy:
   - [ ] Strict Typing: `uv run mypy .` exits with code 0.
   - [ ] Automated Tests: `uv run pytest -v` exits with code 0.
   - [ ] Linters: `uv run ruff check .` exits with code 0.
   - [ ] Git Cleanliness: `git diff --check` exits with code 0.
   - [ ] Atomic Commit: Conventional Commits in English (`feat(scope): ...`, `fix(scope): ...`).
   - [ ] Task Log: Active task logged in `.agent/TASK.md` with commit hash; next task promoted.
   - [ ] Notes Log: Key architectural decisions or traps documented in `.agent/NOTES.md`.

---

## Fail-Stop Protocol & Escalation Hierarchy (Circuit Breaker)

If an automated command (test, build, typecheck, lint) fails **2 consecutive times** with the same root cause:
1. The agent MUST STOP execution immediately.
2. The agent MUST NOT attempt unapproved speculative refactorings.
3. The agent MUST escalate to the user with a structured diagnostic block:
   ```yaml
   failure_stage: "test | typecheck | lint | build"
   error_signature: "exact error message"
   consecutive_failures: 2
   root_cause_analysis: "technical description"
   attempted_fixes:
     - "fix 1 description"
     - "fix 2 description"
   pending_decision: "question or proposed options for user"
   ```

---

## Task Numbering (`[XX.Y]`)

Format: `[Epic].[Sequence]` with two-digit epics. Subtasks: `[XX.Y.Z]`. Exactly **one** task active in `RUNNING` status. IDs are immutable within a release cycle. After Git tag: archive to `ARCHIVE.md`, restart at `[00.1]`/`[01.1]`, and update active task ID. Future Backlog: `[99.1] Prepare Release (Git Tag) and Sanitize Context` — **NEVER** start without explicit user permission.

**Next ID:** Derived solely from Active Task + Log of current cycle. Ignore Future Backlog and closing sections. Same epic → `Y+1`. New epic → `[XX+1.1]`. Never jump to `90.x`/`99.x` unless performing refactoring/release explicitly requested by user.

| Prefix | Phase | Focus |
| :---: | :--- | :--- |
| **`00.x`** | Bootstrap & Setup | `pyproject`, linters, layout `src/`, Compose, CI/CD, governance |
| **`01.x`** | Foundation | SQLite job store, HTTP core, `next_run_at` tick, HTTP `/send` client |
| **`02.x`** | Pens & Capabilities | YAML routines, MCP stdio, agenda skills, Web UI, lifecycle |
| **`90.x`** | Refactoring | Performance and technical debt |
| **`99.x`** | Hardening & Release | Audit and release tag — human approval required |

---

## Post-Release Hygiene (Trigger: Git tag on any phase)

Not restricted to phase `99.x`. When releasing `vX.Y.Z`:

1. **Archive:** Move completed log from `TASK.md` to `ARCHIVE.md` under `## [vX.Y.Z] - YYYY-MM-DD`.
2. **Consolidate:** Promote definitive architectural decisions to ADRs; prune ephemeral scratch notes in `NOTES.md`.
3. **Perimeter:** Sync `.env.example` and `README.md` to the release tag.
4. **Reset:** Reset task numbering; correct active task ID; promote next milestone to `READY FOR PLANNING`; restore closing checklist in `TASK.md`.

---

## Stack

- **OS / shell:** Linux (WSL2) / Bash — use this syntax in terminal commands.
- **Architecture:** Modular monolith, **one process / one container**: FastAPI (HTTP & Web) + asyncio tick (dispatch) + sqlite3 WAL + routines.yaml merge.
- **Language:** Python 3.13+.
- **Package Manager:** **UV** — `pip` directly is PROHIBITED. Use `uv add`, `uv sync`, `uv run`.
- **Frameworks:** FastAPI, Pydantic v2, Pydantic-Settings, httpx. Logs NDJSON with standard library `logging` (skill `victorialogs-integration`, Pattern 2 Option B — without Loguru).
- **SQLite Schema:** `CREATE TABLE IF NOT EXISTS` and versioned migration on connect (`PRAGMA user_version`). No Alembic. No APScheduler.
- **Linter / Types / Tests:** Ruff, mypy (strict mode), pytest.
- **Persistence:** SQLite 3 WAL on volume (`DATABASE_PATH`). No Redis in this repo — dispatch queue, if any, lives in the gateway.
- **Dispatch Gateway:** HTTP `POST {WHATSAPP_API_URL}/send` with header `x-api-key`. `202 Accepted` = success; no polling, no immediate re-dispatch. Names `WHATSAPP_*` are historic.
- **Imports:** Explicit imports; no `__init__.py` barrel files. Global schemas in `src/schemas/`. Internal feature helpers prefixed with `_`.

---

## Docker

Compose is the daily runtime environment in the homelab. Fast code validation: `uv run` on the host. Compose when the task involves container image, volume, network, or real dispatch.

Allowed: `up -d`, `logs`, `build`, `restart`, `exec`, `down` (without `-v`).

**MUST NOT:**
- Execute `system prune`, `builder prune`, `volume rm`, or `rmi` on external images.
- Execute `down -v` (destroys data volumes).
- Commit plaintext credentials or real `.env` files.

Every application service in compose **MUST**: stable `container_name`; `LOG_FORMAT=json`; `NO_COLOR=1`; `ENV`/`ENVIRONMENT`; `SERVICE_NAME=homelab-schedule`; `APP=homelab-schedule`; logging driver `json-file` with `max-size: 10m`, `max-file: 3`. Image: uvicorn `--no-access-log` (`GET /health` discarded by Vector on HDD profiles). Apply global skill `victorialogs-integration` when modifying logs or compose.

For composes/images without a pinned version: adopt the latest stable release.

---

## MCP (Model Context Protocol)

| Server | Role |
| :--- | :--- |
| **`homelab-schedule`** (this repo, stdio) | Agent pen: `schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`, `pause`, `resume`, `snooze`. Communicates via local HTTP (`uv run homelab-schedule-mcp`). |
| **`victorialogs`** (global) | Runtime diagnostics. Does NOT replace `list_agenda`. |

Prefer MCP over ad-hoc curl once the server exists. Direct production mutation via MCP requires user consent. NEVER log auth tokens. `mcp.json` in editor profiles is local — **do not** version control.

MCP tools in this project: closed surface (see [ADR-005](./.agent/adr/005-mcp-superficie-fechada.md)). No generic CRUD, no unbounded `PATCH`.

---

## Skills

Read `.agent/skills/<name>/SKILL.md` when a task touches that skill's domain. For repetitive workflows (>3 steps), create a new skill from `.agent/skills/000-template.md`. Host infrastructure belongs in **global** skills.

Global skills (mandatory when applicable):
- `victorialogs-integration` — logs, compose, stdout (stdlib NDJSON).
- `victorialogs-troubleshooting` — investigate errors via VictoriaLogs MCP.
- `github-bug-issue` — record deferred defects as GitHub issues.

Repo Domain Skills:
| Skill | Trigger |
| :--- | :--- |
| `database-migration` | sqlite3 schema changes on connect (`CREATE`/`ALTER`) |
| `api-endpoint` | HTTP routes: thin router $\rightarrow$ service $\rightarrow$ repository |
| `mcp-tool` | Stdio MCP tools (closed schema, tokens, no generic CRUD) |
| `anotar-agenda` | Human requests to record/remind/list/cancel agenda |
| `agenda-job` | Job fields contract (when/to/content) |
| `whatsapp-dispatch` | HTTP client `POST /send`; 202 = success |
| `due-tick` | Loop `next_run_at` + Event; catch-up once/cron |

---

## Validation Commands

Run at repository root:
- **Dependencies:** `uv sync`
- **Add package (explicit approval required):** `uv add <package>`
- **Tests:** `uv run pytest -v` (Exit code MUST be 0)
- **Lint:** `uv run ruff check .` (Exit code MUST be 0)
- **Types:** `uv run mypy .` (Exit code MUST be 0)
- **Git diff check:** `git diff --check` (Exit code MUST be 0)
- **Local dev server:** `uv run uvicorn homelab_schedule.main:create_app --factory --reload --port 8003`

Adding new dependencies REQUIRES explicit user approval.

---

## Golden Rules

- **MUST NOT** use loose typing (`any`/`Any`). All functions and schemas MUST be strictly typed.
- **MUST NOT** install dependencies or use `pip` directly without explicit user permission.
- **MUST NOT** break payload contracts (`.agent/NOTES.md`, `.agent/ENDPOINTS.md`, skill `whatsapp-dispatch`).
- **MUST NOT** use fields `to`, `body`, `message`, or `Authorization: Bearer` on `POST /send` — use ONLY `phone_number`, `content`, `x-api-key`.
- **MUST NOT** treat `202 Accepted` from `/send` as a failure or retry immediately.
- **MUST NOT** place recipient phone numbers/JIDs, message text, or `request_id` as log stream fields.
- **MUST NOT** deliver mocks, syntax errors, or unresolved `TODO` comments as completed tasks.
- **MUST NOT** put business or persistence logic in routes/controllers; use service and repository layers.
- **MUST NOT** delete files or execute out-of-scope refactorings.
- **MUST NOT** mutate SQLite schema via MCP; use versioned Python migration on connect (`database-migration`).
- **MUST NOT** add APScheduler, Alembic, or Loguru without explicit user request.
- **MUST NOT** invent API parameters or endpoints without documentation or skill references.
- **MUST NOT** ignore domain skills relevant to the active task.
- **MUST NOT** read or modify files outside this project directory or inspect host credentials/SSH keys.
- **MUST NOT** implement chat bots or conversational command parsers in this repo — callers use HTTP `/jobs` or MCP.

---

## Code Quality & Contrast Pairs

Functions MUST NOT exceed ~40 lines of code. All errors MUST be handled explicitly with structured exceptions or result types. Pydantic v2 schemas in `src/schemas/`. Internal feature helpers prefixed with `_`.

NDJSON logging: one JSON object per line, no pretty-printing; lowercase `level` (`WARNING` $\rightarrow$ `warn`); tracebacks on the same event in `stack_trace`; non-canonical extras in `context`.

Default timezone: `America/Sao_Paulo` (`TZ`). Log timestamps: ISO-8601 UTC.

### Contrast Pairs (DO / DON'T)

```python
# BAD: Loose typing, business logic in router, direct SQL execution
@router.post("/jobs")
async def create_job(request: dict[str, Any]):
    db = sqlite3.connect("data/schedule.db")
    cursor = db.cursor()
    cursor.execute(f"INSERT INTO jobs VALUES ('{request.get('id')}', '{request.get('name')}')")
    db.commit()
    return {"status": "ok"}

# GOOD: Strictly typed Pydantic schema, thin router, delegated service call
@router.post("/jobs", status_code=status.HTTP_201_CREATED, response_model=JobResponse)
async def create_job(
    payload: JobCreateRequest,
    service: JobService = Depends(get_job_service),
) -> JobResponse:
    job = await service.schedule_job(payload)
    return JobResponse.model_validate(job)
```

```markdown
# BAD: Vague commit message with multiple concerns and past tense
git commit -m "fixed stuff, updated yaml and changed tests"

# GOOD: Atomic Conventional Commit in English imperative
git commit -m "feat(scheduler): enforce until expiration limit on recurring jobs"
```

---

## Git Conventions

- **Atomic Commits:** Each commit MUST represent a single logical change.
- **Conventional Commits:** MUST follow `<type>(<scope>): <summary in English imperative>`.
  - `feat`: new capability with automated test
  - `fix`: bug fix with regression test
  - `refactor`: structural cleanup without behavior change
  - `test`: test additions or adjustments
  - `chore`: maintenance, dependencies, configuration
  - `docs`: documentation only
- **Branch Strategy:** Trunk-based development on `main`.
- **Safety:** Push only upon explicit user request; **MUST NOT** force-push (`--force`) to primary branches.
