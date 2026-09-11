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

### [2026-09-11] Compose slim e NDJSON stdlib

- **Contexto:** Homelab precisa de um container e logs que o Vector/VictoriaLogs parseiem.
- **Decisão:** `python:3.13-slim` + `uv sync --frozen --no-dev`, um worker uvicorn, `--no-access-log`. Compose: `container_name=homelab-schedule`, `LOG_FORMAT=json`, `NO_COLOR=1`, `ENV`/`ENVIRONMENT`, volume `schedule-data` em `/data`. Formatter stdlib: `WARNING`→`warn`; extras não canônicos em `context` (JID/`content` não são stream field). Segredos só no `.env`.
- **Consequências:** `WHATSAPP_API_URL` tem de resolver o gatekeeper a partir da rede Docker. Skill de anotação MCP é `[02.4]`.

### [2026-09-11] MCP stdio com quatro tools via HTTP

- **Contexto:** Agente precisa de caneta sem OpenAPI inteiro nem SQLite direto.
- **Decisão:** SDK `mcp` 2.x (`MCPServer` stdio). Tools `schedule` / `list_agenda` / `get_item` / `cancel` chamam `SCHEDULE_API_URL` com `x-api-key`. `when` ISO → `once`; cinco campos → `cron`. Lista sem `content`, teto 50. 409 → `edite routines.yaml`. Erro de rede cita a URL, nunca a chave. Script `homelab-schedule-mcp`.
- **Consequências:** Cursor `mcp.json` continua local. Skill de anotação `[02.4]`.

### [2026-09-11] Merge `routines.yaml` por `id` estável no boot

- **Contexto:** Rotinas permanentes vivem no git; recados sqlite não podem ser sobrescritos por acidente.
- **Decisão:** Loader no lifespan (sem watch). `when` = cron de 5 campos. Merge atualiza título/conteúdo/`to`/cron; cron igual preserva `next_run_at`. Id sumiu do arquivo → yaml job `paused`. Id já usado por `source=sqlite` → `YamlIdConflict` (boot falha). PyYAML `safe_load`.
- **Consequências:** Cancel HTTP de yaml continua 409. MCP `[02.2]` não precisa falar com o arquivo.

### [2026-09-11] Tick `next_run_at` + gatekeeper httpx

- **Contexto:** `[01.3]` precisava disparar no tempo sem APScheduler e sem mentir 202.
- **Decisão:** Loop asyncio no lifespan (cap 5 min, Event nas escritas). Cron de 5 campos no `TZ` com walker stdlib (sem croniter). Alias `WHATSAPP_ALIASES` → JID; POST `/send` com `phone_number`/`content`/`quote_id`/`x-api-key`. 202 → `last_status=queued`; 401/422 → `status=error` sem retry; 5xx → backoff 5s. Run-now não altera `next_run_at`.
- **Consequências:** YAML merge ainda é `[02.1]`. Logs de falha não incluem JID/`content` como dimensão.

### [2026-09-11] HTTP `/health` e `/jobs`; run-now 501 até o tick

- **Contexto:** `[01.2]` precisava da caneta HTTP sem o cliente do gatekeeper.
- **Decisão:** FastAPI factory (`create_app`), auth `x-api-key` (`SCHEDULE_API_KEY`) em tudo exceto `/health`. Cancel sqlite `once` → `done` + `next_run_at` nulo; cron → `paused`. YAML → 409. Escritas (create/cancel/run) setam `asyncio.Event`. `POST /jobs/{id}/run` responde 501 e **não** muda o agendamento. Lista omite `content`.
- **Consequências:** `[01.3]` troca o 501 por POST `/send` e liga o loop no Event. Uvicorn: `--factory homelab_schedule.main:create_app`.

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
