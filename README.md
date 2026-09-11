# homelab-schedule

Agenda leve do homelab: um container Python agenda recados **pontuais** e **recorrentes** e dispara `POST /send` na [WhatsApp API](https://github.com/yegear/whatsapp-api) (`gatekeeper-py`).

O envio é assíncrono. `202 Accepted` significa que a mensagem entrou na fila. O gateway aplica delay anti-ban; este serviço **não** faz polling nem reenvia na hora.

## Canetas (mesmo caderno)

| Canal | Quem usa | v1 neste repo |
| :--- | :--- | :--- |
| **MCP** (`schedule`, `list_agenda`, `get_item`, `cancel`) | Agente no Cursor | Sim |
| **HTTP** (`/jobs`, `/health`) | Scripts e o próprio MCP | Sim |
| **YAML** (`routines.yaml`) | Rotinas permanentes do homelab | Sim |
| **WhatsApp** (`!lembra` / `!agenda`) | Você no celular | Só [contrato](.agent/CHANNELS.md); implementação no `whatsapp-api` |

Você anota em português (*“amanhã 14h, pagar condomínio”*). O agente (MCP) ou o bot grava um job. Destinos usam **alias** (`eu`, `grupo-homelab`), não JID cru no dia a dia.

## Stack

- Python 3.13+, UV, FastAPI, sqlite3 WAL, tick `next_run_at` (sem APScheduler/Alembic)
- Um processo: API HTTP + scheduler
- Logs NDJSON (VictoriaLogs / Vector)
- Compose no homelab; `TZ=America/Sao_Paulo`

Detalhe para agentes: [`AGENTS.md`](./AGENTS.md), [`.agent/NOTES.md`](./.agent/NOTES.md), [`.agent/TASK.md`](./.agent/TASK.md).

## Desenvolvimento

```bash
cp .env.example .env
uv sync
uv run pytest -v
uv run ruff check .
uv run mypy .
```

Compose (após existir `docker-compose.yml`):

```bash
docker compose up -d
docker compose logs -f
```

## MCP (Cursor)

Não versione `.cursor/mcp.json`. Depois da tarefa do servidor stdio, aponte o Cursor para o script do repo com `SCHEDULE_API_URL` e `SCHEDULE_API_KEY` no ambiente do MCP — o servidor só encapsula a HTTP.

## Integração WhatsApp

Variáveis `WHATSAPP_API_URL` e `WHATSAPP_API_KEY`. Payload canônico: `phone_number` (JID `@c.us` / `@g.us`), `content`, header `x-api-key`. Playbook: skill global `whatsapp`.

## Repositório

GitHub: `yegear/homelab-schedule`.
