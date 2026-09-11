# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

### 📌 Tarefa [02.4]: Skill Cursor de anotação (quando usar MCP)

- **Descrição:** Skill do repo (a partir de `000-template.md`) ensinando o agente a anotar/listar/cancelar via MCP `homelab-schedule` (não curl ad-hoc, não `/send`). Gatilho: “anota / me lembra / agenda / o que tem marcado”. Apontar para `agenda-job` + CHANNELS. Listar no `AGENTS.md` e `.agent/skills/README.md`.
- **Sistema(s) Envolvido(s):** `.agent/skills/`, skill `000-template`, `agenda-job`
- **Tipo de Ação:**
  - [x] Somente leitura / Documentação
  - [ ] Escrita de código-fonte
- **Status:** PRONTO PARA PLANEJAMENTO
  *(Fluxo: `PRONTO PARA PLANEJAMENTO` → `EM PLANEJAMENTO` ao apresentar plano → aprovação → `EM EXECUÇÃO`)*

### Critérios de Aceite
- [ ] SKILL.md com quando usar MCP vs YAML vs HTTP
- [ ] Confirmacão id + próximo disparo + destino + texto
- [ ] Catalogada no README de skills e no AGENTS.md

---

## Log de Tarefas Concluídas

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [02.3] | Compose slim + logs NDJSON stdlib | [`c41ff51`] | 2026-09-11 |
| [02.2] | MCP stdio (quatro tools) | [`d212d6d`] | 2026-09-11 |
| [02.1] | Loader `routines.yaml` (merge por `id` estável) | [`4d95ec6`] | 2026-09-11 |
| [01.3] | Tick `next_run_at` + cliente gatekeeper | [`e32910b`] | 2026-09-11 |
| [01.2] | HTTP `/health` e `/jobs` (CRUD mínimo + run now + Event) | [`9d35bbe`] | 2026-09-11 |
| [01.1] | Modelo de job + sqlite3 WAL + `CREATE TABLE` no connect | [`37073f3`] | 2026-09-11 |
| [00.1] | Bootstrap UV, pyproject, ruff, mypy, pytest e layout `src/` | [`303a9c8`] | 2026-09-11 |
| [00.0.1] | Constituição do produto, contratos e ADRs | [`a9d1766`] [`671ba19`] | 2026-09-11 |
| [00.0] | Scaffolding inicial (ADD greenfield) | [`2c7ba79`] | 2026-09-11 |

---

## Backlog (Próximas, em ordem)

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
