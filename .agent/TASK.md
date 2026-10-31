# TASK.md — Current Task and Roadmap

> WHAT to do now. Detailed history lives in `git log`. User requests during conversation
> take precedence — report discrepancies before acting.

---

## Active Task

- **Task:** `[00.11]` Governance Alignment: Rename .agent/adr/ Files to Technical English and Update Cross-References
- **Status:** `RUNNING`
- **Scope:**
  - Rename `.agent/adr/` files from Portuguese to canonical Technical English kebab-case via `git mv`:
    - `001-monolito-python-uv.md` $\rightarrow$ `001-python-monolith-uv.md`
    - `002-sqlite-e-yaml.md` $\rightarrow$ `002-sqlite-and-yaml.md`
    - `003-canetas.md` $\rightarrow$ `003-pens-and-notebook.md`
    - `004-dispatch-gatekeeper.md` $\rightarrow$ `004-gateway-dispatch.md`
    - `005-mcp-superficie-fechada.md` $\rightarrow$ `005-closed-mcp-surface.md`
    - `007-ui-mesmo-repo.md` $\rightarrow$ `007-in-repo-web-ui.md`
  - Update all cross-references across `.agent/NOTES.md`, `AGENTS.md`, `.agent/CHANNELS.md`, and within the ADRs themselves.
  - Maintain zero broken links and pass all linters, type checks, and automated tests.
- **Approval:** Approved by user with "proceed" on 2026-10-31.
- **Plan:**
  1. Execute `git mv` on all 6 ADR files.
  2. Update all Markdown links in `.agent/NOTES.md`, `AGENTS.md`, and `.agent/adr/*.md`.
  3. Validate repository integrity (`uv run ruff check .`, `uv run mypy .`, `uv run pytest -v`, `git diff --check`).
  4. Create atomic commit `docs(adr): rename adr files to technical english and update references`.
  5. Log task completion in `.agent/TASK.md` and promote `[02.16.2]` as `READY FOR PLANNING`.
- **Validation:** `uv run pytest -v`, `uv run mypy .`, `uv run ruff check .` and `git diff --check` must exit with code 0.

### Next Planned Tasks

- **[02.16.2]** HIG Global Components, Modals, and Primitives (`ApiKeyModal`, `BackupModal`, `SnoozeModal`, `RescheduleModal`, `ContactPickerModal`, and `Toast`)

- **[02.16.3]** HIG Support Screens (`TemplatesPage`, `ContactsPage`, and `ContactDetailPage`)
- **[02.16.4]** HIG Agenda Core (`JobsPage`, `JobTimelineView`, and `JobCalendarView`)
- **[02.15]** Fast Tabular CSV Export for Jobs and Execution History (`job_runs`)

---

## Completed Tasks Log

Cycles `v0.1.0`, `v0.2.0`, `v0.3.0`, and `v0.4.0` archived in `ARCHIVE.md`.

- [00.10] Governance Alignment: Migrate .agent/ Documentation and ADRs to Technical English | [`61e9a15`] | 2026-10-31 | 201 tests, mypy, ruff, diff check: exit 0

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
