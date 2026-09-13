# NOTES.md — Decisões, Contexto e Contratos do Projeto

> O PORQUÊ. O QUE fica no `git log` / `TASK.md`. Só escreva aqui se explicar uma
> decisão; changelog não entra. Dumps de tarefa já em ADR/`git log` não se repetem.

---

## Visão

```text
caneta MCP / HTTP / YAML (+ UI no mesmo container, ciclo `[00.x]` pós-v0.2.0)
        → caderno (SQLite + routines.yaml)
            → tick: next_run_at UTC + asyncio.Event
                → POST {WHATSAPP_API_URL}/send  →  202 queued
```

Um processo. Sem Redis, sem APScheduler, sem Alembic, sem cliente de mensageiro neste repo. UI web não entra no v0.2.0; backend para o front é o ciclo `[00.x]` (numeração reiniciada após a tag).

---

## ADRs formais

| ADR | Título | Status | Data |
|---|---|---|---|
| [ADR-001](adr/001-monolito-python-uv.md) | Um processo FastAPI + tick SQLite, UV, Python 3.13 | Aprovado | 2026-09-11 |
| [ADR-002](adr/002-sqlite-e-yaml.md) | SQLite WAL para recados; YAML para rotinas permanentes | Aprovado | 2026-09-11 |
| [ADR-003](adr/003-canetas.md) | Três canetas neste repo; callers HTTP fora da árvore | Aprovado | 2026-09-11 |
| [ADR-004](adr/004-dispatch-gatekeeper.md) | Dispatch só via POST /send; 202 = sucesso | Aprovado | 2026-09-11 |
| [ADR-005](adr/005-mcp-superficie-fechada.md) | MCP superfície fechada (`schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`) | Aprovado | 2026-09-11 |
| [ADR-006](adr/006-tick-next-run.md) | Avisos no tempo: `next_run_at` + tick asyncio | Aprovado | 2026-09-11 |

---

## Decisões que não estão só no ADR

### [2026-09-12] Higiene pós-`v0.2.0`

- **Contexto:** Tag + GitHub Release + README/env já existiam; `NOTES.md` ainda era dump de todo o ciclo e o backlog não tinha sido promovido.
- **Decisão:** Enxugar NOTES (o detalhe vive no `git log` e nos ADRs). Corrigir ADR-002 (watch YAML) e ADR-005 (`reschedule`). Reiniciar numeração; próxima tarefa `[00.1]`.

### [2026-09-12] Release `v0.2.0` (não reusar `v0.1.0`)

Tag `v0.1.0` já publicada. HEAD de 12/09 → **`v0.2.0`**. Owner GitHub `yegear1`. Porta HTTP **8003**. Docs públicos sem spec de bot nem repo irmão. Nomes `WHATSAPP_*` no código são históricos.

### [2026-09-12] Docs sem contrato de chat

Canetas versionadas = MCP, HTTP, YAML. Dispatch = `POST /send` genérico. Callers externos usam `/jobs` por conta própria.

### Schema e produto (ciclo até v0.2.0)

- `target_number` no job (migração v1→v2); tick não re-resolve alias.
- `retry_count` (v2→v3): até 3 retries transitórios; 401/422 falham na hora.
- Placeholders temporais no disparo (`templates.py`); sem Jinja2.
- `GET /jobs` e MCP: `status` (inclui `error`) + `limit`. Query `to` = fim de **data**.
- `JOB_RETENTION_DAYS` (padrão 365; `0` desliga). Purge só `done`/`error` sqlite.
- YAML: merge por `id` + reload `mtime` / `POST /routines/reload`.

---

## Contratos vigentes

| Canal | Produtor | Consumidor | Payload |
|---|---|---|---|
| HTTP `/jobs` | MCP, curl, callers | API homelab-schedule | [ENDPOINTS.md](ENDPOINTS.md) |
| HTTP `/contacts` | UI / curl | API homelab-schedule | [ENDPOINTS.md](ENDPOINTS.md) |
| MCP stdio | Agente Cursor | HTTP local | [ADR-005](adr/005-mcp-superficie-fechada.md) |
| `routines.yaml` | Git / operador | Loader + watch | [CHANNELS.md](CHANNELS.md) |
| `POST /send` | Dispatcher | Gateway `WHATSAPP_API_URL` | `phone_number`, `content`, `quote_id`, `x-api-key` |

Alteração de contrato = schemas dos lados na mesma tarefa.

---

## Armadilhas

- **`/send`:** só `phone_number` + `content` + `x-api-key`. Não `to`/`body`/`Authorization`.
- **202:** enfileirado. Retry imediato duplica.
- **Logs:** destino e `content` nunca são stream field.
- **SQLite:** um writer. Esquecer o `Event` após escrita atrasa até o cap de 5 min.
- **YAML vs SQLite:** merge por `id` estável; cancel YAML → `409`.
- **`GET /jobs?to=`:** intervalo de data, não destino. Pessoa: `GET /jobs?phone=`.

---

## Débitos assumidos

| Débito | Motivo | Quando revisitar |
|---|---|---|
| Sem UI web no v0.2.0 | ADR-003 | Ciclo `[00.x]` (humano pediu) |
| Sem `created_by` / filtro por telefone | Job só tem destino | Fechado em `[00.2]` (`?phone=`) |
| Contatos só em `WHATSAPP_ALIASES` | Env, não CRUD | Fechado em `[00.1]` (`/contacts`) |
| Templates só data/hora | Sem catálogo nem `{{name}}` | `[00.3]` |
| Sem HA / multi-réplica | Um SQLite + um tick | Se houver segundo host |
