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
| [ADR-007](adr/007-ui-mesmo-repo.md) | UI operador no mesmo repo (`web/` + `proto/`, Svelte 5) | Aprovado | 2026-09-12 |

---

## Decisões que não estão só no ADR

### [2026-09-13] Remediações do QA Audit da UI (BUG-001 a BUG-013)

- **Tema Claro / Dark Mode:** Implementação de variáveis CSS para paleta completa em `web/src/app.css` (`:root` e `:root.dark, [data-theme="dark"]`) com helper `withOpacity()` no `web/tailwind.config.js` para suportar modificadores alpha (`bg-tertiary/10`, etc.).
- **Content-Type & Client Resiliency:** `web/src/lib/api.ts` agora envia explicitamente `Accept: application/json` e valida o `Content-Type` de resposta antes de parsear JSON, emitindo `ApiClientError` estruturado caso o servidor devolva HTML/502/404.
- **SPA Fallback no Backend:** `_is_html_request` em `main.py` retorna `False` se `Accept: application/json` estiver presente, garantindo 401/404 JSON nas requisições de API, e `True` em navegações normais de navegador (`Accept: text/html`).
- **Interações & UX:** Remoção de `window.confirm` síncrono bloqueante no cancelamento de jobs; suporte a tecla `Escape` e botão Fechar nos modais/drawers; rolagem horizontal (`min-w-[660px]`/`min-w-[560px]` com `overflow-x-auto`) nas tabelas de Jobs e Contatos para suportar telas menores (~700px); tradução e localização pt-BR de rótulos e chips de status.

### [2026-09-13] Grupos de Envio (Múltiplos Destinatários, group_id no SQLite v7)

- **Contexto:** Necessidade de criar um mesmo agendamento (título, conteúdo/modelo, horário, criador) para múltiplos contatos e gerenciar o envio coletivo ou individual.
- **Decisão:** Abordagem de jobs individuais com chave de agrupamento `group_id TEXT` indexada na tabela `jobs` (`user_version` 7). Preserva o modelo de execução atômico do `due-tick`, permitindo que o sucesso/falha/retry de um destinatário não interfira nos demais.
- **Superfície:** `POST /jobs/batch` (cria os N registros e gera `group_id`), `POST /jobs/group/{group_id}/cancel`, `POST /jobs/group/{group_id}/run` (202 Accepted em lote), e filtro `group_id` no `GET /jobs`. Na UI, chips múltiplos no modal de criação e card de membros no drawer com disparo/cancelamento em lote.

### [2026-09-13] Servir UI estática no FastAPI + Multi-stage Docker

Dockerfile multi-stage: Stage 1 (`node:22-alpine`) compila o Svelte 5 SPA em `web/dist`, Stage 2 (`python:3.13-slim`) copia para `/app/web/dist`.
FastAPI monta `/assets` com `StaticFiles`. Navegação no navegador (`GET`/`HEAD` com `Accept: text/html`) entrega `index.html` (SPA fallback em `/`, 401 de auth de rota e 404), preservando 401/404 JSON estritos para chamadas de API (`Accept: application/json` e mutações).

### [2026-09-13] Porte da UI em Svelte 5 (`web/`)

Porte fiel dos protótipos Stitch (`proto/scr-*`) para Svelte 5 SPA com Tailwind e TypeScript. Chrome extraído em `web/src/layout/AppShell.svelte`, 4 rotas (`/contacts`, `/contacts/{id}`, `/templates`, `/jobs`) em `web/src/pages/`, cliente HTTP tipado em `web/src/lib/api.ts` com `x-api-key` no client e 202 tratado como enfileirado.

### [2026-09-12] UI: operador agora, contas depois

Contrato [INTERFACE.md](INTERFACE.md) **aprovado** com quatro telas e `x-api-key`. Cadastro/login/OTP/senha e “admin vs usuário” **adiados** até validar essa superfície. MCP/scripts continuam na chave; não misturar sessão de pessoa nesta versão.

### [2026-09-12] Catálogo de templates

HTTP `/templates` no SQLite (`user_version` 6). Sem tool MCP. Job: `template_id` **ou** `content`. Snapshot do `body` no create; no disparo o `body` atual do catálogo vence se o id ainda existir. `{{name}}` vem do contato com `phone = target_number`; senão a tag fica literal. Sem Jinja.

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
- Placeholders no disparo (`templates.py`): relógio + `{{name}}` do contato destino; sem Jinja2. Catálogo SQLite (`/templates`).
- `GET /jobs` e MCP: `status` (inclui `error`) + `limit`. Query `to` = fim de **data**.
- `JOB_RETENTION_DAYS` (padrão 365; `0` desliga). Purge só `done`/`error` sqlite.
- YAML: merge por `id` + reload `mtime` / `POST /routines/reload`.

---

## Contratos vigentes

| Canal | Produtor | Consumidor | Payload |
|---|---|---|---|
| HTTP `/jobs` | MCP, curl, callers | API homelab-schedule | [ENDPOINTS.md](ENDPOINTS.md) |
| HTTP `/contacts` | UI / curl | API homelab-schedule | [ENDPOINTS.md](ENDPOINTS.md) |
| HTTP `/templates` | UI / curl | API homelab-schedule | [ENDPOINTS.md](ENDPOINTS.md) |
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
| Sem UI web no v0.2.0 | ADR-003 | Contrato aprovado `[00.4]`; proto/port a seguir |
| Contas / OTP / senha na UI | Validar operador + chave primeiro | Depois da UI atual |
| Sem `created_by` / filtro por telefone | Job só tem destino | Fechado em `[00.2]` (`?phone=`) |
| Contatos só em `WHATSAPP_ALIASES` | Env, não CRUD | Fechado em `[00.1]` (`/contacts`) |
| Templates só data/hora | Sem catálogo nem `{{name}}` | Fechado em `[00.3]` (`/templates`) |
| Sem HA / multi-réplica | Um SQLite + um tick | Se houver segundo host |
