---
name: api-endpoint
description: Implement and evolve FastAPI REST endpoints following strict 3-tier layering (router -> service -> repository) and Pydantic v2 schemas.
---

# REST Endpoint Development (`api-endpoint`)

Canonical specification for creating and evolving FastAPI REST endpoints in homelab-schedule.

## 1. Scope & Blast Radius

- **MUTABLE PATHS:** `src/api/**`, `src/services/**`, `src/repositories/**`, `src/schemas/**`, `tests/**`, `.agent/ENDPOINTS.md`.
- **IMMUTABLE PATHS:** Database migration definitions (`src/db/**`), dispatch gateway client (`src/dispatcher/**`), `.env`.
- **FORBIDDEN ACTIONS:**
  - MUST NOT place persistence or business domain logic inside router handlers.
  - MUST NOT execute direct SQL queries or external gateway HTTP requests inside routers.
  - MUST NOT return HTTP 200 for failures (e.g., returning `{"status": "error"}`); use canonical HTTP status codes.
  - MUST NOT expose generic unbounded `PATCH` endpoints; implement discrete action endpoints.
  - MUST NOT use loose typing (`Any`, `dict[str, Any]`); all schemas and handlers MUST be strictly typed.

## 2. When to Use (Triggers)

The agent MUST activate this skill when:
- Creating a new HTTP route in the FastAPI application.
- Adding or altering request parameters (query, path, headers) or request/response bodies.
- Adding or updating HTTP exception handlers and error contracts.

The agent MUST NOT activate this skill when:
- Modifying the underlying SQLite schema on connection (activate `database-migration`).
- Exposing tools on the MCP stdio interface (activate `mcp-tool`).
- Calling external dispatch gateway endpoints (activate `whatsapp-dispatch`).

## 3. Required Tools & Prerequisites

- **Tools / MCPs:** `uv run pytest`, `uv run ruff check .`, `uv run mypy .`.
- **Pre-Conditions:** Endpoint contract documented in `.agent/ENDPOINTS.md`; Pydantic v2 models created in `src/schemas/`.

## 4. Conflict Resolution & Precedence

Precedence order when rules conflict:
1. Security, Credentials & Blast Radius (Enforce `x-api-key: SCHEDULE_API_KEY` on all routes except `/health`)
2. Falsifiable Invariants & Automated Verification (Strict Pydantic typing, zero unchecked `Any`, tests pass)
3. Task Specifications & Performance (Thin router $\to$ service $\to$ repository architecture)
4. Style & Formatting Conventions (Naming conventions, max ~40 LOC per handler)

If an unresolvable rule conflict occurs, the agent MUST halt execution and request human clarification.

## 5. Operational Procedure

### Step 1: Contract & Schema Definition
1. Document endpoint path, query parameters, request payload, and response codes in `.agent/ENDPOINTS.md`.
2. Define strictly typed request and response models in `src/schemas/` using Pydantic v2:
   - Field validations (`Field(min_length=...)`)
   - Strict types without `Any`
3. Enforce API authentication dependency: header `x-api-key: SCHEDULE_API_KEY` required on all non-public endpoints.

### Step 2: Layered Implementation
1. **Router (`src/api/**`):** Validate input schemas via FastAPI dependencies, delegate execution to service, declare explicit `status_code` (`201` for creation, `200` for read/update, `204` for no-content deletion) and `response_model`.
2. **Service (`src/services/**`):** Implement domain rules and business workflows. Raise typed domain exceptions on rule violations.
3. **Repository (`src/repositories/**`):** Execute parameterized SQL against SQLite connection. Return domain models or raise not-found exceptions.
4. If a job originates from YAML (`source: yaml`), reject modification/deletion attempts with HTTP 409 Conflict (`YamlJobImmutableError`).

### Step 3: Exception Mapping & Validation
1. Map domain exceptions via global exception handlers:
   - `EntityNotFoundError` $\to$ HTTP 404
   - `ValidationError` / Pydantic failure $\to$ HTTP 422
   - `UnauthorizedError` $\to$ HTTP 401
   - `YamlJobImmutableError` $\to$ HTTP 409
   - Gateway failure during immediate run $\to$ HTTP 502
2. Verify that error payloads contain clear error messages without leaking server filesystem paths or secrets.
3. Execute validation suite:
   ```bash
   uv run pytest -v
   uv run ruff check .
   uv run mypy .
   ```

## 6. Fail-Stop & Escalation Protocol

- **Retry Limit:** If type checking, linting, or tests fail 2 consecutive times with the same error, STOP execution immediately.
- **Escalation Payload:** Report MUST state:
  1. Identified root cause (e.g., Pydantic schema validation mismatch, broken test assertion)
  2. Exact command executed and output
  3. Current workspace git diff
- **Forbidden Action:** The agent MUST NOT attempt undocumented ad-hoc workarounds or bypass safety checks once the retry limit is reached.

## 7. Git & Environment Safety

- **Forbidden Git Commands:** NEVER run `git push --force`, `git reset --hard`, or `git clean -fd` without explicit human instruction.
- **Secret Protection:** NEVER expose API keys, database paths, or private credentials in error responses or logs.

## 8. Contrast Pairs

```python
// BAD: Business logic in router, direct SQL execution, loose typing
@router.post("/jobs")
async def create_job(request: dict[str, Any]):
    db = sqlite3.connect("data/schedule.db")
    db.execute(f"INSERT INTO jobs VALUES ('{request.get('id')}', '{request.get('name')}')")
    db.commit()
    return {"status": "ok"}

// GOOD: Strictly typed schema, thin router, delegated service call
@router.post("/jobs", status_code=status.HTTP_201_CREATED, response_model=JobResponse)
async def create_job(
    payload: JobCreateRequest,
    service: JobService = Depends(get_job_service),
) -> JobResponse:
    job = await service.schedule_job(payload)
    return JobResponse.model_validate(job)
```

## 9. Verification Checklist

- [ ] Command `uv run pytest tests/test_api.py -v` exits with status code 0
- [ ] Command `uv run mypy .` exits with status code 0
- [ ] Command `uv run ruff check .` exits with status code 0
- [ ] Request and response models defined in `src/schemas/` with zero unchecked `Any`
- [ ] Router contains zero raw SQL queries and zero direct HTTP client calls
- [ ] Endpoint documented in `.agent/ENDPOINTS.md`
