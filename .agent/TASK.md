# TASK.md — Current Task and Roadmap

> WHAT to do now. Detailed history lives in `git log`. User requests during conversation
> take precedence — report discrepancies before acting.

---

## Active Task

- **Task:** `[02.16.2]` Componentes Globais, Modais e Primitivas HIG
- **Status:** `READY FOR PLANNING`
- **Scope:**
  - Aplicar os tokens semânticos e padrões de movimento em `ApiKeyModal`, `BackupModal`, `SnoozeModal`, `RescheduleModal`, `ContactPickerModal` e `Toast`.
  - Preservar IDs, contratos, foco, teclado e comportamento das ações.
- **Approval:** Plano detalhado pendente; tarefa ainda não iniciada.
- **Validation:** `npm run check`, `npm run build`, `uv run pytest -v`, `uv run mypy .`, `uv run ruff check .` e `git diff --check` devem sair com código 0.

### Próximas tarefas planejadas (Epic [02.16] Apple HIG Redesign)

- **[02.16.3]** Telas de Apoio HIG (`TemplatesPage`, `ContactsPage` e `ContactDetailPage`)
- **[02.16.4]** Núcleo de Agendas HIG (`JobsPage`, `JobTimelineView` e `JobCalendarView`)

### Próxima tarefa de produto preservada

- **Task:** `[02.15]` Exportação Rápida em CSV de Agendas e Histórico de Disparos (`job_runs`)
- **Status:** `READY FOR PLANNING`
- **Scope:**
  - Exportação de listagens de agendamentos e histórico de execuções de disparos (`job_runs`) em formato tabular CSV via API HTTP e interface Web UI.
  - Endpoints dedicados para download direto com cabeçalhos `Content-Disposition`.
  - Botões de exportação rápida na interface do operador.

---

## Completed Tasks Log

Ciclos `v0.1.0`, `v0.2.0`, `v0.3.0` e `v0.4.0` arquivados em `ARCHIVE.md`.

- [02.16.1] Tokens semânticos HIG e AppShell translúcido responsivo; tema segmentado e movimento reduzido | [`2b44137`] | 2026-10-31 | check/build, 201 testes, mypy, Ruff e diff check: exit 0
- [02.15.1] Ícone do site (calendário com relógio compartilhado entre header e favicon) | [`327a573`] | 2026-10-31
- [02.14] Previsão de Próximos Disparos (*Upcoming Runs* para Recorrentes na API, MCP e Web UI) | [`e4d0b11`] | 2026-10-04
- [02.13] Tags e Categorias de Agenda (`tags: list[str]` no SQLite v11, API, MCP e Web UI) | [`2946683`] | 2026-10-04
- [02.12] Síntese Matinal e Prevenção de Conflitos no MCP (`daily_digest` e aviso preventivo) | [`0fd5685`] | 2026-09-29
- [00.9] Higiene Pós-Release v0.4.0 e Arquivamento de Contexto | [`5ca7d08`] | 2026-09-29
- [00.8] Separação do README em versão padrão (en) e versão pt-br | [`f4004ea`] | 2026-09-28
- [00.7] Refatoração e Padronização das Skills de IA (.agent/skills/) com agent-doc-refactor | [`2bf28b0`] | 2026-09-28
- [00.6] Alinhamento de Governança com Padrões do Template Hub (template-agent) | [`0d93985`] | 2026-09-22

---

## Backlog (Upcoming, in priority order)

- [ ] **[02.16]** Métricas e Sumário Operacional no MCP (`health_metrics` e resumo agregado de status)

---

## Release / Cycle Wrap-up (Not the next task)

Release/tag only with explicit human request. When triggered, the ID is `[99.1]`. Do not number feature, hygiene, or CI tasks as `99.x`. Do not calculate next task ID from this section.

---

## Future Backlog / Ideas (Unprioritized)

- [ ] **[02.8]** Contas: OTP + Senha + Sessão na UI (Adiado para avaliação futura de necessidade)

---

## How to Keep this File Lean

1. Detail only in the active task. When complete $\rightarrow$ log one line and promote the next task.
2. Backlog is a list of titles. Full spec only when an item becomes the active task.
3. Next ID = last ID in log (or active task). Cycle wrap-up and `[99.1]`: see `AGENTS.md`.
