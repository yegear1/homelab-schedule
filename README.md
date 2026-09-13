# homelab-schedule

Agenda leve do homelab: um container Python agenda recados **pontuais** e **recorrentes** e dispara `POST /send` na [WhatsApp API](https://github.com/yegear/whatsapp-api) (`gatekeeper-py`).

O envio é assíncrono. `202 Accepted` significa que a mensagem entrou na fila. O gateway aplica delay anti-ban; este serviço **não** faz polling nem reenvia na hora.

## Canetas (mesmo caderno)

| Canal | Quem usa | v1 neste repo |
| :--- | :--- | :--- |
| **MCP** (`schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`) | Agente no Cursor | Sim |
| **HTTP** (`/jobs`, `/health`, `/routines/reload`, `/housekeeping/purge`) | Scripts e o próprio MCP | Sim |
| **YAML** (`routines.yaml`) | Rotinas permanentes do homelab (reload automático por mtime ou `/routines/reload`) | Sim |
| **WhatsApp** (`!lembra` / `!agenda` / `!cancela`; `!agenda all` admin) | Celular; lista pessoal por número | Só [contrato](.agent/CHANNELS.md); implementação no `whatsapp-api` |

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
uv run uvicorn homelab_schedule.main:create_app --factory --reload --port 8003
```

Compose:

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f
```

O SQLite vive no volume `schedule-data`. Segredos ficam no `.env`, não no YAML. `WHATSAPP_API_URL` deve alcançar o gatekeeper a partir do container.

## MCP (Cursor)

Não versione `.cursor/mcp.json`. Com a API no ar:

```bash
uv run homelab-schedule-mcp
```

No `mcp.json` local, `command`/`args` apontam para esse script (`uv run --directory <repo> homelab-schedule-mcp`) com `SCHEDULE_API_URL` e `SCHEDULE_API_KEY` no `env` do servidor. O MCP só encapsula a HTTP; não abre o SQLite.

## Integração WhatsApp & Gateways Compatíveis

Variáveis `WHATSAPP_API_URL` e `WHATSAPP_API_KEY`. Payload canônico enviado no POST: `phone_number` (número normalizado ou JID `@c.us` / `@g.us`), `content`, header `x-api-key`. Playbook: skill global `whatsapp`.

> **Arquitetura Aberta:** Embora o conector padrão do homelab seja a WhatsApp API (`gatekeeper-py`), o `homelab-schedule` foi concebido com uma interface de disparo desacoplada (`Dispatcher`). Qualquer serviço HTTP ou webhook que aceite o payload canônico (`phone_number` e `content`) pode ser utilizado como endpoint de envio.

## Housekeeping & Retenção

- **Expurgo Automático Diário:** O loop de tick executa um housekeeping diário expurgando jobs finalizados (`status IN ('done', 'error')` e `source = 'sqlite'`) com idade superior a `JOB_RETENTION_DAYS` (padrão: 365 dias / 1 ano). Configure `JOB_RETENTION_DAYS=0` para desativar o expurgo automático.
- **Expurgo Manual via API:** `POST /housekeeping/purge?days=365` (requer `x-api-key`). Jobs com status `scheduled` e rotinas de arquivo (`source = 'yaml'`) são sempre preservados.

## Templates Dinâmicos de Mensagem

No momento do disparo, variáveis de data/hora no `content` do recado são interpoladas automaticamente no fuso horário configurado (`TZ`, padrão `America/Sao_Paulo`):

| Placeholder | Exemplo de Saída | Descrição |
| :--- | :--- | :--- |
| `{{date}}` | `11/09/2026` | Data no formato brasileiro `DD/MM/YYYY` |
| `{{date_iso}}` | `2026-09-11` | Data no formato `YYYY-MM-DD` |
| `{{time}}` | `08:00` | Horário no formato `HH:MM` |
| `{{weekday}}` | `sex` | Dia da semana curto em português |
| `{{day_name}}` | `sexta-feira` | Dia da semana por extenso |
| `{{month_name}}` | `setembro` | Nome do mês por extenso |
| `{{year}}` | `2026` | Ano atual com 4 dígitos |

O template permanece intacto na definição do job para que rotinas recorrentes (`cron`) sejam interpoladas a cada ciclo.

## Repositório

GitHub: [`yegear1/homelab-schedule`](https://github.com/yegear1/homelab-schedule). Versão atual: `0.2.0` (`homelab-schedule-mcp`).

