# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

### 📌 Tarefa [01.1]: Modelo de job + sqlite3 WAL + `CREATE TABLE` no connect

- **Descrição:** Persistência do caderno: connect sqlite3 com `PRAGMA journal_mode=WAL`, schema `jobs` e índice de vencimento no connect (sem Alembic). Models Pydantic do job alinhados a [ENDPOINTS.md](ENDPOINTS.md). Sem HTTP de agenda ainda — repository + init de schema + testes com arquivo tempfile.
- **Sistema(s) Envolvido(s):** `src/homelab_schedule/`, SQLite (`DATABASE_PATH`), skill `database-migration`
- **Tipo de Ação:**
  - [ ] Somente leitura / Documentação
  - [x] Escrita de código-fonte
- **Status:** PRONTO PARA PLANEJAMENTO
  *(Fluxo: `PRONTO PARA PLANEJAMENTO` → `EM PLANEJAMENTO` ao apresentar plano → aprovação → `EM EXECUÇÃO`)*

### Critérios de Aceite
- [ ] `CREATE TABLE IF NOT EXISTS jobs` + índice `(status, enabled, next_run_at)` no connect
- [ ] WAL ligado; testes: arquivo novo cria schema; reconnect em arquivo existente não quebra
- [ ] Campos alinhados ao recurso `Job` (id, title, content, to, kind, run_at/cron_expr, enabled, source, status, next_run_at, last_*)
- [ ] Sem FastAPI/`/jobs` (isso é `[01.2]`)

---

## Log de Tarefas Concluídas

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [00.1] | Bootstrap UV, pyproject, ruff, mypy, pytest e layout `src/` | [`303a9c8`] | 2026-09-11 |
| [00.0.1] | Constituição do produto, contratos e ADRs | [`a9d1766`] [`671ba19`] | 2026-09-11 |
| [00.0] | Scaffolding inicial (ADD greenfield) | [`2c7ba79`] | 2026-09-11 |

---

## Backlog (Próximas, em ordem)

- [ ] **[01.2]** HTTP `/health` e `/jobs` (CRUD mínimo + run now + Event) — `[api]`
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
