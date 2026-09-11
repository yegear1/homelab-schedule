# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

### 📌 Tarefa [00.1]: Bootstrap UV, pyproject, ruff, mypy, pytest e layout `src/`

- **Descrição:** Trocar o starter vazio por um pacote Python 3.13 instalável via UV: `pyproject.toml`, Ruff, mypy estrito, pytest, layout `src/` sem barrel `__init__`, `.env` a partir do example. Sem FastAPI de jobs ainda — só esqueleto que `uv run pytest` / `ruff` / `mypy` passam.
- **Sistema(s) Envolvido(s):** raiz do repo, futuro `src/`, `tests/`
- **Tipo de Ação:**
  - [ ] Somente leitura / Documentação
  - [x] Escrita de código-fonte
- **Status:** PRONTO PARA PLANEJAMENTO
  *(Fluxo: `PRONTO PARA PLANEJAMENTO` → `EM PLANEJAMENTO` ao apresentar plano → aprovação → `EM EXECUÇÃO`)*

### Critérios de Aceite
- [ ] `uv sync` funciona; `uv.lock` versionado
- [ ] `uv run pytest -v`, `uv run ruff check .` e `uv run mypy .` passam
- [ ] Proibido `pip`; Python ≥ 3.13 no `requires-python`
- [ ] Nenhum endpoint de agenda ainda (isso é `[01.x]`)

---

## Log de Tarefas Concluídas

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [00.0] | Scaffolding inicial (ADD greenfield) + constituição do produto | *(pending commit)* | 2026-09-11 |

---

## Backlog (Próximas, em ordem)

- [ ] **[01.1]** Modelo de job + sqlite3 WAL + `CREATE TABLE` no connect — `[store]`
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
