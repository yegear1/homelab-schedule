# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

### 📌 Tarefa [01.2]: HTTP `/health` e `/jobs` (CRUD mínimo + run now + Event)

- **Descrição:** FastAPI: `GET /health` sem auth; `/jobs` com `x-api-key` (`SCHEDULE_API_KEY`). Router fino → service → `JobRepository`. Criar/listar/obter/cancelar recados sqlite; `POST /jobs/{id}/run` ainda pode só persistir o pedido ou devolver 501 se o cliente gatekeeper não existir — preferir stub de Event + persistência e deixar o POST `/send` para `[01.3]` se o cliente não estiver pronto. `asyncio.Event` no app state após escrita no caderno.
- **Sistema(s) Envolvido(s):** FastAPI, skill `api-endpoint`, [ENDPOINTS.md](ENDPOINTS.md)
- **Tipo de Ação:**
  - [ ] Somente leitura / Documentação
  - [x] Escrita de código-fonte
- **Status:** PRONTO PARA PLANEJAMENTO
  *(Fluxo: `PRONTO PARA PLANEJAMENTO` → `EM PLANEJAMENTO` ao apresentar plano → aprovação → `EM EXECUÇÃO`)*

### Critérios de Aceite
- [ ] Rotas alinhadas a ENDPOINTS.md (`/health`, GET/POST `/jobs`, GET `/jobs/{id}`, cancel; run-now sem disparo real se `[01.3]` ainda não existir — documentar)
- [ ] Auth `x-api-key` em tudo exceto `/health`
- [ ] Sem regra de negócio no router; Pydantic nos schemas
- [ ] Tick / cliente WhatsApp ficam em `[01.3]`

---

## Log de Tarefas Concluídas

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [01.1] | Modelo de job + sqlite3 WAL + `CREATE TABLE` no connect | [`37073f3`] | 2026-09-11 |
| [00.1] | Bootstrap UV, pyproject, ruff, mypy, pytest e layout `src/` | [`303a9c8`] | 2026-09-11 |
| [00.0.1] | Constituição do produto, contratos e ADRs | [`a9d1766`] [`671ba19`] | 2026-09-11 |
| [00.0] | Scaffolding inicial (ADD greenfield) | [`2c7ba79`] | 2026-09-11 |

---

## Backlog (Próximas, em ordem)

- [ ] **[01.3]** Tick `next_run_at` + cliente gatekeeper (`due-tick`, `whatsapp-dispatch`) — `[tick]`
- [ ] **[02.1]** Loader `routines.yaml` (merge por `id` estável) — `[routines]`
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
