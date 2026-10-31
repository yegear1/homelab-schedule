# Contributing to homelab-schedule

Thank you for your interest in contributing to **homelab-schedule**!

This project is a lightweight, single-process agenda and scheduler service running in homelab environments. We welcome issues, bug reports, and pull requests that adhere to our architectural invariants and development standards.

---

## Architectural Invariants

Before proposing changes, please note the fundamental design constraints of this repository:

1. **Modular Monolith & Single Container:** FastAPI (REST API & Web UI) + asyncio background tick loop + SQLite WAL + declarative YAML routines. Zero Redis, zero APScheduler, zero Alembic, and zero messaging client sockets in this repo.
2. **Strict 3-Tier Layering:** Routers remain thin (`src/homelab_schedule/api/`). Business and orchestration logic resides in services (`src/homelab_schedule/services/`), and database queries reside in repositories (`src/homelab_schedule/db/`).
3. **Outbound Dispatch Contract:** Dispatches message payloads exclusively via `POST {WHATSAPP_API_URL}/send` with header `x-api-key`. Body uses ONLY `phone_number` and `content`. Never use `to`, `body`, `message`, or `Authorization: Bearer`. `202 Accepted` denotes successful enqueuing.
4. **Log Hygiene:** Never log recipient phone numbers, message contents, or private tokens in log stream fields. Standard library NDJSON logging is required.
5. **Strict Typing:** All code must pass `mypy --strict` with zero unchecked `Any` declarations.

---

## Getting Started

### Prerequisites

- **Python:** 3.13 or newer
- **UV:** Package manager ([uv](https://docs.astral.sh/uv/)) — direct use of `pip` is prohibited.
- **Node.js:** 20+ (for Web UI development in `web/`)
- **Docker & Docker Compose:** For container runtime validation

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yegear1/homelab-schedule.git
   cd homelab-schedule
   ```

2. **Install backend dependencies:**
   ```bash
   uv sync
   ```

3. **Install frontend dependencies:**
   ```bash
   cd web
   npm install
   cd ..
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your local ports and keys
   ```

5. **Run the development server:**
   ```bash
   uv run uvicorn homelab_schedule.main:create_app --factory --reload --port 8003
   ```

---

## Verification & Testing

Every pull request must pass all automated validation checks before being merged:

```bash
# 1. Run backend automated test suite
uv run pytest -v

# 2. Run Ruff linter and code formatting checks
uv run ruff check .

# 3. Run strict type checking
uv run mypy .

# 4. Check for trailing whitespace and merge artifacts
git diff --check

# 5. Run Web UI type checks and build
cd web && npm run check && npm run build && cd ..
```

Adding new dependencies requires explicit rationale and review.

---

## Commit Guidelines

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification in English imperative tense:

- `feat(scope): ...` — New capability with automated tests
- `fix(scope): ...` — Bug fix with regression test
- `refactor(scope): ...` — Structural cleanup without behavior change
- `test(scope): ...` — Test additions or adjustments
- `chore(scope): ...` — Maintenance, dependencies, configuration
- `docs(scope): ...` — Documentation updates only

**Example:**
```bash
git commit -m "feat(scheduler): enforce until expiration limit on recurring jobs"
```

---

## Pull Request Checklist

When submitting a pull request:
- [ ] Working branch is branched off `main`.
- [ ] New functionality or bug fixes include accompanying automated tests (`tests/`).
- [ ] All verification commands (`pytest`, `ruff`, `mypy`, `npm check`, `npm build`) exit with code 0.
- [ ] No secrets, tokens, or personal identifiers are committed.
- [ ] Atomic commits using Conventional Commits syntax.
