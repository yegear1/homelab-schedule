# ENDPOINTS.md — Contrato HTTP (planejado)

Fonte para a skill `api-endpoint`. Auth em todas as rotas exceto `/health`: header `x-api-key: <SCHEDULE_API_KEY>`. Sem `Authorization: Bearer`.

Base local: `http://localhost:8002`.

## Ops

| Método | Rota | Classe | Notas |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | ops-only | `{ "status": "ok" }`. Vector pode descartar no HDD. |

## Jobs

Job persistido (SQLite). Rotinas YAML aparecem na listagem com `source: yaml` e **não** aceitam `DELETE` via HTTP (edite o arquivo). Recados `source: sqlite` aceitam cancelamento.

### Recurso `Job`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | string | UUID (sqlite) ou id estável do YAML |
| `title` | string | Uma linha para listar |
| `content` | string | Texto do WhatsApp |
| `to` | string | Alias (`eu`) ou JID |
| `kind` | `once` \| `cron` | |
| `run_at` | string ISO-8601 \| null | Obrigatório se `once`. Interpretação no `TZ` da app se sem offset |
| `cron_expr` | string \| null | Cinco campos (min hour dom mon dow). Obrigatório se `cron` |
| `enabled` | bool | |
| `source` | `sqlite` \| `yaml` | |
| `status` | `scheduled` \| `done` \| `paused` \| `error` | `once` vira `done` após disparo ok |
| `next_run_at` | string ISO-8601 UTC \| null | Relógio do tick (ADR-006). `once` usa `run_at` convertido; `cron` = próxima parede em `TZ` |
| `last_run_at` | string ISO-8601 UTC \| null | |
| `last_status` | string \| null | `queued` se gatekeeper 202 |
| `last_error` | string \| null | Sem stack na resposta pública |

### `GET /jobs`

Query: `status` (`upcoming` \| `done` \| `paused` \| `all`, default `upcoming`), `from`, `to` (ISO). Lista **curta**: sem `content` completo (truncar ou omitir; `GET /jobs/{id}` tem o texto).

`200` → `{ "jobs": [ JobListItem ] }`

### `GET /jobs/{id}`

`200` Job completo. `404` se inexistente.

### `POST /jobs`

Cria recado sqlite.

```json
{
  "title": "condomínio",
  "content": "Pagar condomínio.",
  "to": "eu",
  "kind": "once",
  "run_at": "2026-09-12T14:00:00-03:00"
}
```

Cron: `"kind": "cron", "cron_expr": "0 9 * * 1"` (segunda 09:00 no `TZ`). `to` default `eu`. `201` + Job. `422` schema. `401` chave inválida.

### `POST /jobs/{id}/run`

Disparo imediato (não altera `once` para `done` se também houver `run_at` futuro — **run now não substitui o agendamento**). `202` `{ "status": "queued", "job_id": "..." }` se o gatekeeper aceitou. `404`. `502` se o gatekeeper falhar (não 202).

### `POST /jobs/{id}/cancel`

Sqlite: pontual → remove ou `status=done` cancelado; cron → `enabled=false` / `paused`. YAML: `409` com mensagem para editar o arquivo. `404`. `204` ou `200` com Job.

Não há `PATCH` genérico no v1. Reagendar = cancel + create.

## Erros

JSON `{ "detail": ... }` no estilo FastAPI. Não vazar path de SQLite nem API keys.
