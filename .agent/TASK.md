# TASK.md — Current Task and Roadmap

> WHAT to do now. Detailed history lives in `git log`. User requests during conversation
> take precedence — report discrepancies before acting.

---

## Active Task

- **Task:** None; the feature backlog is empty.
- **Status:** `IDLE`
- **Next Step:** Await the next operator task. Release/tag remains gated by explicit request.

---

## Completed Tasks Log

Cycles `v0.1.0`, `v0.2.0`, `v0.3.0`, and `v0.4.0` archived in `ARCHIVE.md`.

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

No additional feature tasks queued.

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
