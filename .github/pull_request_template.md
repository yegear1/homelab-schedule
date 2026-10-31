## Description

<!-- Provide a concise description of the motivation, changes, and scope. -->

## Changes Made

-<!-- list changes here -->

## Invariants & Architectural Checklist

- [ ] Domain logic resides in services/repositories, not routes or MCP tools.
- [ ] No `Any` typing introduced; strict type checking passes.
- [ ] Outbound dispatch payload conforms strictly to `phone_number` and `content` on `POST /send`.
- [ ] No tokens, credentials, or private identifiers committed or logged.

## Verification

- [ ] `uv run pytest -v` passes with 0 failures.
- [ ] `uv run ruff check .` passes with 0 errors.
- [ ] `uv run mypy .` passes with 0 diagnostics.
- [ ] `git diff --check` exits with code 0.
- [ ] (If Web UI changed) `cd web && npm run check && npm run build` passes.
