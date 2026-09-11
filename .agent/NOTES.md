# NOTES.md — Decisões, Contexto e Contratos do Projeto

> O PORQUÊ. O QUE fica no `git log` / `TASK.md`. Só escreva aqui se explicar uma
> decisão; changelog não entra.

---

## Como usar

1. Leia antes de planejar. Decisões aqui vencem a “forma óbvia”, salvo o usuário pedir para revisitar.
2. Registre: trade-off, contrato, armadilha, skill nova, débito consciente.
3. Entrada longa → ADR em `.agent/adr/` e aqui uma linha + link.

---

## Visão

```text
caneta MCP / HTTP / YAML (/ WhatsApp no outro repo)
        → caderno (SQLite jobs + routines.yaml)
            → tick: next_run_at UTC + asyncio.Event
                → POST gatekeeper /send  →  202 queued
```

Um container. Sem Redis, sem APScheduler, sem Alembic. Sem UI web no v1.

---

## ADRs formais

| ADR | Título | Status | Data |
|---|---|---|---|
| [ADR-001](adr/001-monolito-python-uv.md) | Um processo FastAPI + tick SQLite, UV, Python 3.13 | Aprovado | 2026-09-11 |
| [ADR-002](adr/002-sqlite-e-yaml.md) | SQLite WAL para recados; YAML para rotinas permanentes | Aprovado | 2026-09-11 |
| [ADR-003](adr/003-canetas.md) | Quatro canetas, um caderno; WhatsApp só contrato neste repo | Aprovado | 2026-09-11 |
| [ADR-004](adr/004-dispatch-gatekeeper.md) | Dispatch só via POST /send; 202 = sucesso | Aprovado | 2026-09-11 |
| [ADR-005](adr/005-mcp-superficie-fechada.md) | MCP com quatro tools; sem CRUD genérico | Aprovado | 2026-09-11 |
| [ADR-006](adr/006-tick-next-run.md) | Avisos no tempo: `next_run_at` + tick asyncio | Aprovado | 2026-09-11 |

---

## Decisões rápidas

### [2026-09-11] Job store sqlite3 WAL e schemas em `src/schemas/`

- **Contexto:** `[01.1]` precisava do caderno sem HTTP. AGENTS manda contratos globais em `src/schemas/`.
- **Decisão:** Pacote irmão `schemas` (hatch inclui `src/schemas` + `src/homelab_schedule`). Tabela `jobs` completa (campos do recurso Job), índice `idx_jobs_due`, `PRAGMA user_version=1`. Timestamps no banco em UTC ISO-8601; `run_at` ingênuo assume `America/Sao_Paulo`. `once` sem `next_run_at` copia `run_at`. YAML ainda não faz merge (`[02.1]`).
- **Consequências:** HTTP `[01.2]` reusa `Job` + `JobRepository`. Pydantic v2 é dependência de runtime.

### [2026-09-11] Pacote `homelab_schedule` sob `src/`

- **Contexto:** Bootstrap `[00.1]` precisava de um import instalável sem FastAPI.
- **Decisão:** Layout `src/homelab_schedule/` (hífen do repo → underscore). `__init__.py` só marca o pacote; sem reexport barrel. Stub `health.ping()` para o trio pytest/ruff/mypy. Runtime deps (FastAPI, pydantic, httpx) ficam para `[01.x]`.
- **Consequências:** `uv sync` + `uv run pytest/ruff/mypy` na raiz. Import: `from homelab_schedule.health import ping`.

### [2026-09-11] Constituição greenfield preenchida

- **Contexto:** Starter `template-agent` / greenfield ainda com colchetes. Escopo alinhado em chat: agenda container + WhatsApp + MCP + YAML v1 + contrato de comando WhatsApp.
- **Decisão:** Owner GitHub `yegear`. Fuso `America/Sao_Paulo`. Porta HTTP `8002` (gatekeeper permanece `8001`). Auth desta API: `x-api-key` (`SCHEDULE_API_KEY`), distinta da chave do gatekeeper.
- **Alternativas:** Org `ye-sandbox` (rejeitada pelo humano). YAML só depois (rejeitada: YAML entra no v1).
- **Consequências:** Código ainda não existe; próxima tarefa é bootstrap `uv`/`pyproject`.

### [2026-09-11] Anotação em linguagem natural, store estruturado

- **Contexto:** O que importa para o humano é *como anotar*, não cron cru.
- **Decisão:** Usuário fala quando / para quem / o quê. Servidor grava `kind` (`once` \| `cron`), `run_at` ou `cron_expr`, `to` (alias), `title`, `content`. Agente confirma `id` + próximo disparo + destino + texto.
- **Consequências:** MCP não exige que o modelo monte JSON do gatekeeper. Aliases em `WHATSAPP_ALIASES`.

### [2026-09-11] Tick no SQLite, sem Alembic/APScheduler/Loguru

- **Contexto:** Uso simples; RAM/CPU ociosos importam. Alembic e APScheduler são segunda verdade / histórico que a uma tabela não pede.
- **Decisão:** `CREATE TABLE` no boot; relógio = coluna `next_run_at` UTC + sleep até o mínimo ou Event de escrita (ADR-006). Logs stdlib NDJSON. Imagem slim, um worker.
- **Consequências:** `[01.1]` é schema sqlite3; `[01.3]` é o tick, não APScheduler. Teste “job +2s dispara sem esperar o cap”.

---

## Contratos vigentes

Schema canônico no código (`src/schemas/`) quando existir. Mapa:

| Canal | Produtor | Consumidor | Payload |
|---|---|---|---|
| HTTP `/jobs` | MCP, curl, futuros callers | API homelab-schedule | [ENDPOINTS.md](ENDPOINTS.md) |
| MCP stdio | Agente Cursor | HTTP local | [ADR-005](adr/005-mcp-superficie-fechada.md) |
| `routines.yaml` | Git / operador | Loader no boot + watch | [CHANNELS.md](CHANNELS.md) |
| `POST /send` | Dispatcher deste repo | gatekeeper-py | skill `whatsapp`: `phone_number`, `content`, `quote_id`, header `x-api-key` |
| Comando WhatsApp | logic-worker (`whatsapp-api`) | HTTP deste serviço | [CHANNELS.md](CHANNELS.md) — **não implementar aqui** |

Alteração de contrato = atualizar schemas dos lados na mesma tarefa.

---

## Armadilhas

- **Gatekeeper:** agentes alucinam `to`/`body`/`Authorization`. Só `phone_number` + `content` + `x-api-key`.
- **202:** não é “pendente de confirmação de entrega”. É enfileirado. Retry imediato duplica mensagem.
- **VictoriaLogs:** JID e `content` são campo de evento, nunca stream field. Health `/health` o Vector pode descartar no HDD.
- **SQLite:** um writer (este processo). Não expor o arquivo a outro container com write. Esquecer o `Event` após `POST /jobs` atrasa o aviso até o cap de 5 min.
- **YAML vs SQLite:** rotina YAML não deve ser “copiada e esquecida” no SQLite de forma que um edit no git não atualize o job. Merge por `id` estável da rotina (campo `id` no YAML).

---

## Débitos assumidos

| Débito | Motivo | Quando revisitar |
|---|---|---|
| Comando `!lembra` / `!agenda` só no papel | Código no `whatsapp-api` | Depois do HTTP estável |
| Sem UI web / CalDAV / e-mail | Peso; três canetas bastam | Se o humano pedir |
| MCP ainda não existe | Depende da HTTP | Tarefa `[02.2]` |
| Sem HA / multi-réplica | Um SQLite + um tick | Se houver segundo host |
| Watch YAML em runtime | v1 reload no boot + Event | Se rotinas mudarem sem restart |
