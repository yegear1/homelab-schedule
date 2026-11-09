# TASK.md — Current Task and Roadmap

> WHAT to do now. Detailed history lives in `git log`. User requests during conversation
> take precedence — report discrepancies before acting.

---

## Active Task

- **Task:** [02.30] Agenda Operacional, Composer e Inspetor de Jobs (`/jobs`, filtros, criação single/batch, lifecycle 202, imutabilidade YAML, CSV)
- **Status:** `READY FOR PLANNING`
- **Next Step:** Present implementation plan to wire Agenda views, composer, inspector, lifecycle actions and CSV export to live API.

---

## Completed Tasks Log

- [02.29] Wired contacts and templates workspaces to live API with 409 conflict handling | [`3d2be3d`] | 2026-11-09 | tsc check, Vite build, 22 python auth/spa tests, mypy, Ruff and diff check: exit 0

- [02.28] Wired AppShell, browser history routing, and live AccessDialog connection ping | [`2527b74`] | 2026-11-09 | tsc check, Vite build, 22 python auth/spa tests, mypy, Ruff and diff check: exit 0

- [02.27] Migrated build pipeline, React 19 dependencies, Radix/Zustand tooling, and sanitized auth store | [`c8b6933`] | 2026-11-09 | tsc check, Vite build, 22 python auth/spa tests, mypy, Ruff and diff check: exit 0

- [02.26] Integrated minimalist theme control into sidebar footer, added theme icons, refined segmented styling and cleaned header chrome | [`7f1d1fe`] | 2026-11-08 | 151 browser tests, 247 Python tests, mypy, Ruff, Svelte/config checks, build, 320/390/768/1440 responsiveness review, 200% zoom and diff check: exit 0

- [02.25] Extracted History/Data workspaces, guarded import/replace, authenticated downloads and integrity details; verified C01–C19 replacement | [`19cc709`] | 2026-11-08 | 151 browser tests including disposable real-app/fake-gateway smoke, 247 Python tests, mypy, Ruff, Svelte/config checks, build, 320/390/768/1440 light/dark/reduced-motion screenshot review, 200% zoom and diff check: exit 0

- [02.24] Rebuilt contact directory/detail and template workspaces, guarded CRUD, shared contact job flows and illustrative placeholder editor | [`3862467`] | 2026-11-08 | 123 browser tests, 247 Python tests, mypy, Ruff, Svelte/config checks, build, mobile/desktop/dark screenshot review, 200% zoom and diff check: exit 0

- [02.23] Rebuilt filtered agenda, grouped table, timeline and keyboard calendar with bounded counts, shared actions and synchronized CSV filters | [`1f4361f`] | 2026-11-08 | 95 browser tests, 247 Python tests, mypy, Ruff, Svelte/config checks, build, mobile/desktop/dark screenshot review and diff check: exit 0

- [02.22] Shared responsive inspector, individual/group lifecycle and recovery controls, independent bounded reads and authenticated history CSV | [`818a452`] | 2026-11-08 | 71 browser tests, 247 Python tests, mypy, Ruff, Svelte/config checks, build, mobile/desktop screenshot review and diff check: exit 0

- [02.21] Shared Agenda/Contact composer, typed payload validation, contact/template pickers and advanced editors | [`d1d4f0e`] | 2026-11-08 | 42 browser tests, 247 Python tests, mypy, Ruff, Svelte/config checks, build, mobile screenshot and diff check: exit 0

- [02.20] Responsive labelled shell, shared Svelte primitives, stack-aware modal focus and pre-hydration themes | [`716f48b`] | 2026-11-08 | 31 browser tests, 247 Python tests, mypy, Ruff, Svelte/config checks, build, screenshot review and diff check: exit 0

- [02.19] Tailwind 4 CSS theme/Vite migration, loopback API proxy and typed Playwright foundation | [`913589e`] | 2026-11-08 | 10 browser tests, 247 Python tests, mypy, Ruff, Svelte/config checks, build, clean npm ci and diff check: exit 0

- [02.18] Remove embedded browser credential fallback, unify authenticated transport errors and refresh shell credential status | [`c752aca`] | 2026-11-08 | 247 tests, mypy, Ruff, Svelte check/build, source/build credential scan and diff check: exit 0

- [02.17] Approved Web UI capability inventory, contract, surface and sequential implementation plan | [`208a632`] | 2026-11-08 | 234 tests, mypy, Ruff, Svelte check/build and diff check: exit 0

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
- [ ] **[02.28]** Shell Global, Navegação e Modal de Acesso (`AppShell`, `cmdk`, `AccessDialog`, tema e conexão real com `/health`)
- [ ] **[02.29]** Workspaces de Contatos e Templates (`/contacts`, `/templates`, CRUD real, modal de conflito 409)
- [ ] **[02.30]** Agenda Operacional, Composer e Inspetor de Jobs (`/jobs`, filtros, criação single/batch, lifecycle 202, imutabilidade YAML, CSV)
- [ ] **[02.31]** Histórico de Execuções e Data Vault (`/history`, `/data`, logs de tentativa, snapshot SQLite, JSON export/import com replace seguro, integridade)
- [ ] **[02.32]** Limpeza do Código Legado, Testes e Validação de Build (exclusão de `*.svelte`, testes Python/Playwright, mypy/ruff, Docker build)


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
