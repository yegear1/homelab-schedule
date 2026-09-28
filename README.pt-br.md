[English](./README.md) | **Português (Brasil)**

---

# homelab-schedule

Agenda leve em um container: jobs **pontuais** e **recorrentes** que, no horário, fazem `POST /send` em um gateway HTTP que você configura. Versão **0.4.0** (`homelab-schedule-mcp`). Notas: [CHANGELOG](./CHANGELOG.md) · [GitHub Release](https://github.com/yegear1/homelab-schedule/releases/tag/v0.4.0).

Este repositório **não** inclui cliente de WhatsApp, bot nem fila anti-ban. Só agenda e dispara. Qualquer serviço que aceite o payload abaixo serve (`202` = aceito na fila). Este serviço não faz polling e não reenvia na hora. Falha transitória (rede, 5xx) reagenda até 3 vezes com backoff; 401/422 marcam o job como `error` na hora.

## Canetas (mesmo caderno)

| Canal | Quem usa | Neste repo |
| :--- | :--- | :--- |
| **Web UI** (`/`, `/contacts`, `/templates`, `/jobs`) | Operador no navegador (Svelte 5: tabela, timeline, calendário e backup) | Sim |
| **MCP** (`schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`, `pause`, `resume`, `snooze`, `preview`) | Agente no Cursor / IA | Sim |
| **HTTP** (`/jobs`, `/contacts`, `/templates`, `/backup`, `/health`, `/routines/reload`, `/housekeeping/purge`) | Scripts, MCP e chamadores externos | Sim |
| **YAML** (`routines.yaml`) | Rotinas permanentes (reload por mtime ou `POST /routines/reload`) | Sim |

Você anota em linguagem natural (*“amanhã 14h, pagar condomínio”* ou *“+15m”*). Destinos: contato (nome ou id), alias `WHATSAPP_ALIASES`, ou número. No create, o servidor grava `target_number` e o tick envia para esse valor.

## Stack

- Python 3.13+, UV, FastAPI, sqlite3 WAL, tick `next_run_at` (sem APScheduler/Alembic)
- Um processo: API HTTP + scheduler integrado
- Logs NDJSON (VictoriaLogs / Vector)
- Compose no homelab; `TZ=America/Sao_Paulo`; HTTP padrão **8003**

Detalhes para agentes: [`AGENTS.md`](./AGENTS.md), [`.agent/NOTES.md`](./.agent/NOTES.md), [`.agent/TASK.md`](./.agent/TASK.md). Contrato HTTP: [`.agent/ENDPOINTS.md`](./.agent/ENDPOINTS.md).

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

O SQLite vive no volume `schedule-data`. Segredos ficam no `.env`, não no YAML. `WHATSAPP_API_URL` é a URL **do gateway de envio** (nome histórico da variável; não implica um repositório específico) e precisa ser alcançável a partir do container. Auth **desta** API: header `x-api-key` = `SCHEDULE_API_KEY` (exceto `GET /health`).

## MCP (Cursor e Agentes)

Não versione `.cursor/mcp.json`. Com a API no ar:

```bash
uv run homelab-schedule-mcp
```

No `mcp.json` local, `command`/`args` apontam para esse script (`uv run --directory <repo> homelab-schedule-mcp`) com `SCHEDULE_API_URL` e `SCHEDULE_API_KEY` no `env` do servidor. O MCP só encapsula a HTTP; não abre o SQLite.

Tools MCP disponíveis:
- `schedule`: cria agendamento pontual ou recorrente (`when`, `to`, `content`, `variables`, `until`, `max_runs`).
- `list_agenda`: lista jobs por status (`upcoming`, `done`, `error`, `paused`, `all`), período relativo (`period`), busca (`query`) e destinatário (`to`).
- `get_item`: detalhe completo de um job por `id`.
- `cancel`: cancela agendamento no banco.
- `reschedule`: altera `run_at` ou `cron_expr` de um job.
- `pause` / `resume`: suspende temporariamente ou reativa um agendamento.
- `snooze`: adia a próxima execução sem modificar a regra cron mestra.
- `preview`: dry-run em memória simulando cálculo de data, resolução de destinatário e renderização de variáveis.

## HTTP (resumo)

- **Jobs:**
  - Lista: `GET /jobs?status=upcoming|done|error|paused|all&limit=…&phone=…&query=…`. Query `to` é **fim de intervalo de data**. `phone` une destino e criador.
  - Detalhe: `GET /jobs/{id}` (inclui `content`, `target_number`, `variables`, `until`, `max_runs`).
  - Criar / cancelar / disparar agora: `POST /jobs`, `POST /jobs/{id}/cancel`, `POST /jobs/{id}/run` (`run` não substitui o agendamento).
  - Lote: `POST /jobs/batch`, `POST /jobs/group/{group_id}/cancel`, `POST /jobs/group/{group_id}/run`.
  - Ciclo de vida: `POST /jobs/{id}/reschedule`, `POST /jobs/{id}/pause`, `POST /jobs/{id}/resume`, `POST /jobs/{id}/snooze`, `POST /jobs/{id}/retry`.
  - Histórico de execuções: `GET /jobs/{id}/runs`, `GET /jobs/runs`.
  - Prévia: `POST /jobs/preview`.
- **Contatos:** `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/{id}` (DELETE `409` se houver job `scheduled` para o telefone).
- **Templates:** `GET/POST /templates`, `GET/PATCH/DELETE /templates/{id}` (DELETE `409` se houver job `scheduled` com aquele `template_id`). `POST /jobs` aceita `template_id` **ou** `content`.
- **Backup e Integridade:** `GET /backup/database` (snapshot SQLite WAL), `GET /backup/export` (bundle JSON), `POST /backup/import` (merge ou replace), `GET /backup/integrity`.
- **Rotinas e Manutenção:** `POST /routines/reload`, `POST /housekeeping/purge`.

## Gateway de envio

No tick (e em `POST /jobs/{id}/run`), o serviço chama:

`POST {WHATSAPP_API_URL}/send`

| Peça | Valor |
| :--- | :--- |
| Header | `x-api-key: {WHATSAPP_API_KEY}` |
| JSON | `phone_number`, `content` (opcionalmente `quote_id`) |
| Sucesso | **`202 Accepted`** — mensagem aceita pelo gateway; não significa entrega ao destinatário |

`phone_number` é o `target_number` do job (E.164, id de chat, ou o que o seu gateway esperar). Um backend de WhatsApp é um caso de uso, não uma dependência deste código.

## Housekeeping & Retenção

- **Expurgo automático diário:** o tick remove jobs `done`/`error` com `source = sqlite` mais velhos que `JOB_RETENTION_DAYS` (padrão 365; `0` desativa) e purga registros antigos de `job_runs`.
- **Expurgo manual:** `POST /housekeeping/purge?days=365` (`x-api-key`). Jobs `scheduled` e rotinas `yaml` são preservados.
- **Alertas de Dead-Letter:** falhas permanentes ou esgotamento de retentativas notificam o operador via `WHATSAPP_ADMIN_NUMBER`.

## Templates dinâmicos de mensagem

No disparo, placeholders de data/hora no `content` são interpolados no `TZ` (padrão `America/Sao_Paulo`). O texto gravado no job/YAML **não** é reescrito — rotinas `cron` interpolam de novo a cada ciclo.

| Placeholder | Exemplo | Descrição |
| :--- | :--- | :--- |
| `{{date}}` | `11/09/2026` | Data `DD/MM/YYYY` |
| `{{date_iso}}` | `2026-09-11` | Data `YYYY-MM-DD` |
| `{{time}}` | `08:00` | Horário `HH:MM` |
| `{{weekday}}` | `sex` | Dia da semana curto (pt) |
| `{{day_name}}` | `sexta-feira` | Dia da semana por extenso |
| `{{month_name}}` | `setembro` | Mês por extenso |
| `{{year}}` | `2026` | Ano com 4 dígitos |
| `{{day}}` | `11` | Dia do mês com 2 dígitos |
| `{{month}}` | `09` | Mês com 2 dígitos |
| `{{hour}}` | `08` | Hora com 2 dígitos |
| `{{minute}}` | `00` | Minuto com 2 dígitos |
| `{{greeting}}` | `Bom dia` | Saudação contextual conforme horário local |
| `{{greeting_lower}}` | `bom dia` | Saudação contextual em minúsculas |
| `{{saudacao}}` | `Bom dia` | Alias para greeting |
| `{{period}}` | `manhã` | Período do dia (`manhã`, `tarde`, `noite`) |
| `{{name}}` | `Maria` | Nome do contato de destino cadastrado na agenda |
| `{{sua_variavel}}` | `12345` | Variável customizada definida no campo `variables` do job |

Jobs podem referenciar `template_id` do catálogo persistido (`/templates`) ou conter mensagem direta. No disparo, `{{name}}` e variáveis customizadas são mescladas com os placeholders temporais.

## Repositório

GitHub: [`yegear1/homelab-schedule`](https://github.com/yegear1/homelab-schedule).
