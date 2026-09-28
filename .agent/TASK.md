# TASK.md — Current Task and Roadmap

> WHAT to do now. Detailed history lives in `git log`. User requests during conversation
> take precedence — report discrepancies before acting.

---

## Active Task

### 📌 Task [00.7]: Refatoração e Padronização das Skills de IA (.agent/skills/) com agent-doc-refactor

- **Description:** Auditoria e refatoração de todas as skills de domínio em `.agent/skills/` (incluindo `000-template.md`) segundo a taxonomia de 7 pilares (`agent-doc-refactor`) e a arquitetura canônica de 9 seções, garantindo falsificabilidade, RFC 2119 e densidade de tokens.
- **Systems Involved:** `governance`, `skills`, `agent-directives`
- **Action Type:**
  - [x] Read-only / Documentation
  - [ ] Source code changes
- **Status:** RUNNING
  *(Workflow: `READY FOR PLANNING` → `PLANNING` on presenting plan → approval → `RUNNING`)*

### Acceptance Criteria
- [ ] Todas as 7 skills de domínio e `000-template.md` reescritas na estrutura canônica de 9 seções.
- [ ] Frontmatter com `name` válido e `description` restrita a $\le 250$ caracteres em active imperative English.
- [ ] Invariantes estritos expressos via marcadores RFC 2119 (`MUST`, `MUST NOT`, `REQUIRED`).
- [ ] Seção 1 (Scope & Blast Radius) com `MUTABLE PATHS`, `IMMUTABLE PATHS` e `FORBIDDEN ACTIONS`.
- [ ] Seção 9 (Verification Checklist) com asserções binárias e checagem de exit code.
- [ ] Validações do repositório (`uv run pytest -v`, `uv run ruff check .`, `uv run mypy .`, `git diff --check`) saindo com código 0.

---

## Completed Tasks Log

Ciclos `v0.1.0`, `v0.2.0` e `v0.3.0` arquivados em `ARCHIVE.md`.

- [00.6] Alinhamento de Governança com Padrões do Template Hub (template-agent) | [`0d93985`] | 2026-09-22
- [00.5] CI/CD de Build e Publicação Docker no GHCR (GitHub Actions)
- [02.11] Ciclo de Vida Avançado para Recorrentes (`until`, `max_runs` e Pausa Temporária/Snooze)
- [02.10] Alertas de Dead-Letter para o Operador (Notificação de Falha Crítica no Gateway)
- [02.9] Variáveis Customizadas em Jobs e Templates (`variables` em Jobs e Interpolação Segura)
- [02.7] Importação / Exportação e Backup do SQLite
- [02.6] Visão em Calendário / Linha do Timeline na UI
- [02.5] Histórico de Execuções (job_runs / auditoria de disparos)
- [02.4] Dead-Letter e Ação Rápida de Re-enfileiramento (Retry Manual na UI e API)
- [02.3] Saudações e Variáveis Dinâmicas Seguras em Templates ({{greeting}}, {{time}}, {{date}})
- [02.2] Tool de Preview / Dry-Run de Agendamento (renderização de variáveis e cálculo de next_run_at)
- [02.1] Filtros Avançados e Busca na Caneta MCP (contato, texto, período relativo)

---

## Backlog (Upcoming, in priority order)

- [ ] **[02.12]** Síntese Matinal e Prevenção de Conflitos no MCP (`daily_digest` e aviso preventivo)

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
