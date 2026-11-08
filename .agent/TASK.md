# TASK.md — Current Task and Roadmap

> WHAT to do now. Detailed history lives in `git log`. User requests during conversation
> take precedence — report discrepancies before acting.

---

## Active Task

- **Task:** [02.17] Plan the full Web UI rebuild while preserving existing capabilities ([GitHub issue](https://github.com/yegear1/homelab-schedule/issues/1)).
- **Status:** `APPROVED`
- **Scope:** Reorganize or add screens freely while preserving every existing UI capability, API meaning, authentication behavior, and backend boundary.
- **Plan:**
  1. Inventory current UI flows using frontend code, API client, tests, `.agent/NOTES.md`, `.agent/ENDPOINTS.md`, and `.agent/INTERFACE.md`.
  2. Reconcile the current UI contract and identify stale or missing screen/action coverage.
  3. Propose the new screen map, navigation, component boundaries, responsive behavior, accessibility, themes, and reduced-motion behavior.
  4. Define the Tailwind 4 stable migration, Vite integration, test strategy, and dependency approvals.
  5. Split implementation into sequential tasks with file scopes and falsifiable acceptance criteria.
  6. After all implementation tasks are planned, clear the old presentation implementation and begin the approved tasks; preserve or replace API/type/auth integration boundaries deliberately.
- **Reset Gate:** Keep the existing UI intact until steps 1–5 are complete. Do not clear `web/` wholesale or remove the existing API client before its replacement boundary is specified.
- **Planning Artifact:** [WEB_UI_REBUILD.md](WEB_UI_REBUILD.md) — C01–C19 inventory, reconciled contract, screen/component proposal, Tailwind migration and scoped acceptance criteria.
- **Approval:** Operator approved the complete plan, surface, fixed pt-BR and proposed dependencies on 2026-11-08 (`proceed`).
- **Next Step:** Complete planning commit and start [02.18]; execute one task at a time. Release/tag remains gated.

---

## Completed Tasks Log

Cycles `v0.1.0`, `v0.2.0`, `v0.3.0`, and `v0.4.0` archived in `ARCHIVE.md`.

- [00.12] Open Source Readiness: Licensing, Community Governance, and Sanitization Audit | [`94a4477`] | 2026-10-31 | 234 tests, mypy, Ruff and diff check: exit 0
- [02.16] Authenticated operational aggregates and bounded `health_metrics` MCP tool; synchronized ADR/contracts and privacy checks | [`4e69ee8`] | 2026-10-31 | 234 tests, mypy, Ruff and diff check: exit 0

- [02.15] Authenticated filtered CSV downloads for jobs and execution history, bounded keyset reads, spreadsheet-safe cells, and accessible UI downloads | [`59c04cd`] | 2026-10-31 | check/build (zero diagnostics), 212 tests, mypy, Ruff and diff check: exit 0

- [02.16.4] Semantic agenda panels, responsive table/timeline/calendar controls, accessible selection and keyboard inspection, and reduced motion | [`5a24c1b`] | 2026-10-31 | check/build (zero diagnostics), 201 tests, mypy, Ruff and diff check: exit 0

- [02.16.3] Semantic support screen presentation, responsive contact rows, accessible controls, keyboard job inspection, and reduced motion | [`8ae2e88`] | 2026-10-31 | check/build, 201 tests, mypy, Ruff and diff check: exit 0

- [02.16.2] Shared semantic modal and Toast presentation; responsive controls, focus styling, accessible labels, and reduced motion | [`8a7d61f`] | 2026-10-31 | check/build, 201 tests, mypy, Ruff and diff check: exit 0

- [00.11] Governance Alignment: Rename .agent/adr/ Files to Technical English and Update Cross-References | [`941eb0f`] | 2026-10-31 | 201 tests, mypy, ruff, diff check: exit 0
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

> Tag pre-approved tasks having strictly disjoint file scopes with `[APPROVED]` `[PARALLEL: W1]` and `Paths: ...` for concurrent `task-queue` execution.


Approved sequential queue; scope and acceptance criteria: [WEB_UI_REBUILD.md](WEB_UI_REBUILD.md#8-sequential-implementation-tasks-draft). Approved by operator on 2026-11-08.

- [02.18] Remove credential fallback and preserve transport behavior.
- [02.19] Add browser behavior harness and Tailwind 4 foundation (dependency approval required).
- [02.20] Replace shell and shared presentation primitives.
- [02.21] Rebuild shared composer and contact/template pickers.
- [02.22] Rebuild inspector, lifecycle and group actions.
- [02.23] Rebuild agenda table, timeline and calendar.
- [02.24] Rebuild contacts and templates workspaces.
- [02.25] Extract History/Data pages and verify full replacement.

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
