# TASK.md — Current Task and Roadmap

> WHAT to do now. Detailed history lives in `git log`. User requests during conversation
> take precedence — report discrepancies before acting.

---

## Active Task

- **Task:** `[00.10]` Governance Alignment: Migrate .agent/ Documentation and ADRs to Technical English
- **Status:** `RUNNING`
- **Scope:**
  - Translate and refactor `.agent/TASK.md`, `.agent/NOTES.md`, and all `.agent/adr/` documents (ADR-000 to ADR-007) into concise Technical English following `agent-doc-refactor`.
  - Translate `.agent/INTERFACE.md` and `.agent/CHANNELS.md` prose to Technical English, preserving data contracts, DOM IDs, and endpoint tables.
  - Add explicit Technical English mandate rule in `AGENTS.md` aligned with `template-agent:greenfield`.
  - Maintain all active architecture contracts, system boundaries, payload invariants, and historical task commit logs.
- **Approval:** Approved by user with "proceed" on 2026-10-31.
- **Plan:**
  1. Refactor and translate `.agent/adr/` (ADR-000 through ADR-007) into standard English ADR structure while preserving technical decisions, dates, and author context.
  2. Refactor `.agent/NOTES.md` into concise Technical English, maintaining active data contracts, SQLite table schema notes, and runtime traps.
  3. Translate `.agent/INTERFACE.md` and `.agent/CHANNELS.md` explanatory prose into Technical English while keeping DOM IDs and tables intact.
  4. Align `AGENTS.md` Golden Rules with `template-agent`'s Technical English requirement.
  5. Translate `.agent/TASK.md` headers, active task scope, and planned backlog into Technical English.
  6. Execute validations (`uv run mypy .`, `uv run pytest -v`, `uv run ruff check .`, `git diff --check`).
  7. Commit atomically as `docs(governance): migrate .agent documentation and adrs to technical english` and promote `[02.16.2]`.
- **Validation:** `uv run pytest -v`, `uv run mypy .`, `uv run ruff check .` and `git diff --check` must exit with code 0.

### Next Planned Tasks

- **[02.16.2]** HIG Global Components, Modals, and Primitives (`ApiKeyModal`, `BackupModal`, `SnoozeModal`, `RescheduleModal`, `ContactPickerModal`, and `Toast`)
- **[02.16.3]** HIG Support Screens (`TemplatesPage`, `ContactsPage`, and `ContactDetailPage`)
- **[02.16.4]** HIG Agenda Core (`JobsPage`, `JobTimelineView`, and `JobCalendarView`)
- **[02.15]** Fast Tabular CSV Export for Jobs and Execution History (`job_runs`)

---

## Completed Tasks Log

Cycles `v0.1.0`, `v0.2.0`, `v0.3.0`, and `v0.4.0` archived in `ARCHIVE.md`.

- [02.16.1] Semantic HIG tokens and responsive translucent AppShell; segmented theme and reduced motion | [`2b44137`] | 2026-10-31 | check/build, 201 tests, mypy, Ruff and diff check: exit 0
- [02.15.1] Site branding icon (shared calendar clock between header and favicon) | [`327a573`] | 2026-10-31
- [02.14] Upcoming Runs Projection for Recurring Jobs across API, MCP, and Web UI | [`e4d0b11`] | 2026-10-04
- [02.13] Agenda Tags and Categories (`tags: list[str]` in SQLite v11, API, MCP, and Web UI) | [`2946683`] | 2026-10-04
- [02.12] Morning Digest and Conflict Detection in MCP (`daily_digest` and preventive warning) | [`0fd5685`] | 2026-09-29
- [00.9] Post-Release v0.4.0 Hygiene and Context Archiving | [`5ca7d08`] | 2026-09-29
- [00.8] Dual Bilingual README Separation (English default and pt-BR localized) | [`f4004ea`] | 2026-09-28
- [00.7] Agent Skills Refactor and Standardization (.agent/skills/) via agent-doc-refactor | [`2bf28b0`] | 2026-09-28
- [00.6] Governance Alignment with Template Hub Standards (template-agent) | [`0d93985`] | 2026-09-22

---

## Backlog (Upcoming, in priority order)

- [ ] **[02.16]** Health Metrics and Operational Summary in MCP (`health_metrics` and aggregate status)

---

## Release / Cycle Wrap-up (Not the next task)

Release/tag only with explicit human request. When triggered, the ID is `[99.1]`. Do not number feature, hygiene, or CI tasks as `99.x`. Do not calculate next task ID from this section.

---

## Future Backlog / Ideas (Unprioritized)

- [ ] **[02.8]** User Accounts: Phone OTP + Password + Browser Session (Deferred pending operator evaluation)

---

## How to Keep this File Lean

1. Detail only in the active task. When complete $\rightarrow$ log one line and promote the next task.
2. Backlog is a list of titles. Full spec only when an item becomes the active task.
3. Next ID = last ID in log (or active task). Cycle wrap-up and `[99.1]`: see `AGENTS.md`.
