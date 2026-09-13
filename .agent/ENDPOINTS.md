# ENDPOINTS.md — Contrato HTTP (planejado)

Fonte para a skill `api-endpoint`. Auth em todas as rotas exceto `/health`: header `x-api-key: <SCHEDULE_API_KEY>`. Sem `Authorization: Bearer`.

Base local: `http://localhost:8003`.

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
| `content` | string | Texto da mensagem |
| `to` | string | Alias (`eu`) ou id de destino |
| `target_number` | string | Destino normalizado (preenchido no create) |
| `kind` | `once` \| `cron` | |
| `run_at` | string ISO-8601 \| null | Obrigatório se `once`. Interpretação no `TZ` da app se sem offset |
| `cron_expr` | string \| null | Cinco campos (min hour dom mon dow). Obrigatório se `cron` |
| `enabled` | bool | |
| `source` | `sqlite` \| `yaml` | |
| `status` | `scheduled` \| `done` \| `paused` \| `error` | `once` vira `done` após disparo ok |
| `next_run_at` | string ISO-8601 UTC \| null | Relógio do tick (ADR-006). `once` usa `run_at` convertido; `cron` = próxima parede em `TZ` |
| `last_run_at` | string ISO-8601 UTC \| null | |
| `last_status` | string \| null | `queued` se o gateway respondeu 202 |
| `last_error` | string \| null | Sem stack na resposta pública |
| `retry_count` | int | Retentativas transitórias |
| `created_by` | string | Telefone normalizado de quem criou; vazio se omitido |

### `GET /jobs`

Query: `status` (`upcoming` \| `done` \| `paused` \| `all`, default `upcoming`), `from`, `to` (ISO **de intervalo de tempo**, não destino), `phone` (destino **ou** criador, normalizado; aceita nome/id de contato), `limit`. Lista **curta**: sem `content` completo.

Query `to` é **fim de intervalo de data**. Filtro de pessoa: `?phone=`.

`200` → `{ "jobs": [ JobListItem ] }` (inclui `created_by`, sem `content`)

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

Cron: `"kind": "cron", "cron_expr": "0 9 * * 1"` (segunda 09:00 no `TZ`). `to` default `eu`. `created_by` opcional (telefone, alias ou contato). `201` + Job. `422` schema. `401` chave inválida.

### `POST /jobs/{id}/run`

Disparo imediato (não altera `once` para `done` se também houver `run_at` futuro — **run now não substitui o agendamento**). `202` `{ "status": "queued", "job_id": "..." }` se o gateway aceitou. `404`. `502` se o gateway falhar (não 202).

### `POST /jobs/{id}/cancel`

Sqlite: pontual → remove ou `status=done` cancelado; cron → `enabled=false` / `paused`. YAML: `409` com mensagem para editar o arquivo. `404`. `204` ou `200` com Job.

Não há `PATCH` genérico. Recado sqlite: `POST /jobs/{id}/reschedule`. YAML: edite o arquivo.

## Contacts

Caderno de pessoas (SQLite). Telefone único, normalizado como `target_number`. Nome único (`NOCASE`). `to` no create de job resolve: **contato** (id ou nome) → `WHATSAPP_ALIASES` → dígitos.

### Recurso `Contact`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | string | UUID |
| `name` | string | 1–80 |
| `phone` | string | Destino normalizado |

### `GET /contacts`

`200` → `{ "contacts": [ Contact ] }` ordenado por nome.

### `POST /contacts`

`{ "name": "Mae", "phone": "5521999887766" }` → `201` Contact. `409` nome ou telefone repetido. `422` schema. `401`.

### `GET /contacts/{id}`

`200` Contact. `404`.

### `PATCH /contacts/{id}`

Campos opcionais `name` e/ou `phone`. `200`. `409` unicidade. `404`.

### `DELETE /contacts/{id}`

`204`. `409` se existir job `status=scheduled` com aquele `target_number`. `404`.

## Erros

JSON `{ "detail": ... }` no estilo FastAPI. Não vazar path de SQLite nem API keys.
