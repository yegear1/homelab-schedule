# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

### 📌 Tarefa [02.1]: Loader `routines.yaml` (merge por `id` estável)

- **Descrição:** No boot, ler `ROUTINES_PATH`, validar rotinas (id estável, kind cron/once, to, content) e mergear no caderno sqlite por `id`. Edit no YAML atualiza o job `source=yaml`. Conflito com id sqlite existente → rejeitar. Cancel HTTP de yaml continua 409. Reload v1 só no boot (watch é débito).
- **Sistema(s) Envolvido(s):** `routines.yaml`, skill `agenda-job`, ADR-002
- **Tipo de Ação:**
  - [ ] Somente leitura / Documentação
  - [x] Escrita de código-fonte
- **Status:** PRONTO PARA PLANEJAMENTO
  *(Fluxo: `PRONTO PARA PLANEJAMENTO` → `EM PLANEJAMENTO` ao apresentar plano → aprovação → `EM EXECUÇÃO`)*

### Critérios de Aceite
- [ ] Merge por `id` estável; `source=yaml`
- [ ] Edit no arquivo reflete no job após boot
- [ ] Conflito id sqlite vs yaml rejeitado
- [ ] Sem watch em runtime

---

## Log de Tarefas Concluídas

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [01.3] | Tick `next_run_at` + cliente gatekeeper | *(este commit)* | 2026-09-11 |
| [01.2] | HTTP `/health` e `/jobs` (CRUD mínimo + run now + Event) | [`9d35bbe`] | 2026-09-11 |
| [01.1] | Modelo de job + sqlite3 WAL + `CREATE TABLE` no connect | [`37073f3`] | 2026-09-11 |
| [00.1] | Bootstrap UV, pyproject, ruff, mypy, pytest e layout `src/` | [`303a9c8`] | 2026-09-11 |
| [00.0.1] | Constituição do produto, contratos e ADRs | [`a9d1766`] [`671ba19`] | 2026-09-11 |
| [00.0] | Scaffolding inicial (ADD greenfield) | [`2c7ba79`] | 2026-09-11 |

---

## Backlog (Próximas, em ordem)

- [ ] **[02.2]** MCP stdio (quatro tools) — `[mcp]`
- [ ] **[02.3]** Compose slim + logs NDJSON stdlib — `[docker]`
- [ ] **[02.4]** Skill Cursor de anotação (quando usar MCP) — `[docs]`

---

## Backlog Futuro / Ideias (não priorizadas)

- [ ] **[99.1]** Preparar Release (Tag Git) e Sanitizar Contexto (Apenas executar com permissão explícita do usuário)
- [ ] Comando WhatsApp `!lembra` / `!agenda` no repo `whatsapp-api` (contrato: `.agent/CHANNELS.md`)
- [ ] `reschedule` no MCP se cancel+schedule for frágil na prática
- [ ] Watch de `routines.yaml` em runtime (v1 pode reload só no boot)

---

## Como manter este arquivo enxuto

1. Detalhe só na tarefa ativa. Concluída → uma linha no log e promover o backlog.
2. Backlog é lista de títulos. Spec completa só quando o item vira tarefa ativa.
3. Numeração, arquivo pós-release e âncora `[99.1]`: ver `AGENTS.md`.
