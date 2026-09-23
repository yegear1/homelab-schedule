# TASK.md — Current Task and Roadmap

> WHAT to do now. Detailed history lives in `git log`. User requests during conversation
> take precedence — report discrepancies before acting.

---

## Active Task

### 📌 Task [02.12]: Síntese Matinal e Prevenção de Conflitos no MCP (`daily_digest` e aviso preventivo)

- **Description:** Tool MCP de consolidação de agenda diária (`daily_digest`) e detecção/alerta preventivo de potenciais conflitos de horários e sobreposição de mensagens para o mesmo destinatário.
- **Systems Involved:** `mcp`, `scheduler`, `api`
- **Action Type:**
  - [ ] Read-only / Documentation
  - [x] Source code changes
- **Status:** READY FOR PLANNING
  *(Workflow: `READY FOR PLANNING` → `PLANNING` on presenting plan → approval → `RUNNING`)*

### Acceptance Criteria
- [ ] Tool `daily_digest` implementada e exposta no servidor MCP stdio.
- [ ] Detecção/alerta de conflitos de horário para o mesmo destinatário/canal.
- [ ] Testes automatizados cobrindo ferramentas novas e validações.
- [ ] Validações (types, lint, test, git diff) saindo com código 0.

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

(Vazio no ciclo atual)

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
