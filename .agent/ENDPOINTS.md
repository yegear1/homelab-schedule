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
| `template_id` | string \| null | Catálogo; no disparo o `body` atual vence o snapshot |
| `group_id` | string \| null | Identificador do lote para agendamentos com múltiplos destinatários |

### `GET /jobs`

Query: `status` (`upcoming` | `done` | `paused` | `error` | `all`, default `upcoming`), `from`, `to` (ISO **de intervalo de tempo**, não destino), `phone` (destino **ou** criador, normalizado; aceita nome/id de contato), `group_id` (filtro por grupo de envio), `query` (busca textual em título ou conteúdo), `limit`. Lista **curta**: sem `content` completo.

Query `to` é **fim de intervalo de data**. Filtro de pessoa: `?phone=`. Filtro de grupo: `?group_id=`. Busca textual: `?query=`.

`200` → `{ "jobs": [ JobListItem ] }` (inclui `created_by`, `template_id`, `group_id`, `last_error`, `retry_count`, sem `content`)

### `GET /jobs/{id}`

`200` Job completo. `404` se inexistente.

### `POST /jobs`

Cria recado sqlite individual.

```json
{
  "title": "condomínio",
  "content": "Pagar condomínio.",
  "to": "eu",
  "kind": "once",
  "run_at": "2026-09-12T14:00:00-03:00"
}
```

Cron: `"kind": "cron", "cron_expr": "0 9 * * 1"` (segunda 09:00 no `TZ`). `to` default `eu`. `created_by` opcional (telefone, alias ou contato). `template_id` **ou** `content` (não os dois). Com `template_id`, o `body` é copiado para `content` (snapshot). `201` + Job. `404` template inexistente. `422` schema. `401` chave inválida.

### `POST /jobs/batch`

Cria múltiplos recados vinculados pelo mesmo `group_id` (um job individual por destinatário).

```json
{
  "title": "Aviso da Reunião",
  "content": "Reunião hoje às 15h.",
  "recipients": ["eu", "5511999998888"],
  "kind": "once",
  "run_at": "2026-09-12T14:00:00-03:00"
}
```

`201` → `{ "group_id": "grp_...", "count": 2, "jobs": [ Job, ... ] }`.

### `POST /jobs/preview`

Dry-run de agendamento (sem inserção no SQLite, sem disparo, sem mutação). Simula a resolução do destinatário, cálculo de `next_run_at` (UTC e horário local em `America/Sao_Paulo`) e renderização completa de variáveis (`{{name}}`, `{{date}}`, `{{time}}`, `{{weekday}}`, `{{day_name}}`, `{{month_name}}`, `{{year}}`).

Aceita `when` (linguagem natural / ISO / cron) ou combinação explícita `kind` + `run_at` / `cron_expr`. Conteúdo via `content` ou `template_id`.

```json
{
  "when": "amanhã 14h",
  "content": "Olá {{name}}, lembrete para {{date}} às {{time}}.",
  "to": "eu"
}
```

`200` →
```json
{
  "title": "Olá {{name}}, lembrete para {{date}} às {{time}}.",
  "to": "eu",
  "target_number": "5511999998888@c.us",
  "recipient_name": "Yegear",
  "kind": "once",
  "run_at": "2026-09-20T17:00:00-03:00",
  "cron_expr": null,
  "next_run_at": "2026-09-20T17:00:00+00:00",
  "next_run_at_local": "2026-09-20 14:00:00 -03:00",
  "template_id": null,
  "raw_content": "Olá {{name}}, lembrete para {{date}} às {{time}}.",
  "rendered_content": "Olá Yegear, lembrete para 20/09/2026 às 14:00.",
  "variables": {
    "name": "Yegear",
    "date": "20/09/2026",
    "date_iso": "2026-09-20",
    "time": "14:00",
    "weekday": "dom",
    "day_name": "domingo",
    "month_name": "setembro",
    "year": "2026"
  }
}
```
`401` chave inválida. `404` template não encontrado. `422` validação de campos.

### `POST /jobs/{id}/run`

Disparo imediato (não altera `once` para `done` se também houver `run_at` futuro — **run now não substitui o agendamento futuro**). Se o job estiver em `status=error`, o disparo bem-sucedido transita para `status=done`, desativa `enabled=false`, limpa `last_error` e zera `retry_count=0`. `202` `{ "status": "queued", "job_id": "..." }` se o gateway aceitou. `404`. `502` se o gateway falhar (não 202).

### `POST /jobs/group/{group_id}/run`

Dispara imediatamente todos os recados ativos vinculados ao `group_id`. `202` → `{ "group_id": "...", "affected": N, "status": "queued" }`.

### `GET /jobs/runs`

Histórico global de execuções/disparos para auditoria. Query: `limit` (1-100, default 50), `status` (`success` | `error`). Ordenado por `ran_at DESC`.

`200` → `{ "runs": [ { "id": "...", "job_id": "...", "ran_at": "...", "trigger": "schedule" | "manual", "status": "success" | "error", "status_code": 202, "duration_ms": 45.2, "error_message": null } ] }`. `401` chave inválida.

### `GET /jobs/{id}/runs`

Histórico de execuções/disparos de um agendamento específico. Query: `limit` (1-100, default 50). Ordenado por `ran_at DESC`.

`200` → `{ "runs": [ JobRun, ... ] }`. `404` job não encontrado. `401` chave inválida.

### `POST /jobs/{id}/cancel`

Sqlite: pontual → remove ou `status=done` cancelado; cron → `enabled=false` / `paused`. YAML: `409` com mensagem para editar o arquivo. `404`. `204` ou `200` com Job.

### `POST /jobs/group/{group_id}/cancel`

Cancela todos os recados sqlite ativos vinculados ao `group_id`. `200` → `{ "group_id": "...", "affected": N, "status": "cancelled" }`.

### `POST /jobs/{id}/retry`

Re-enfileira um job com erro (Dead-Letter) para novo ciclo de agendamento:
- Redefine `status=scheduled`, `enabled=true`, `retry_count=0`, `last_error=null`.
- Se for job `once` com `run_at` no passado, ajusta `next_run_at` e `run_at` para o instante atual para disparo no próximo tick. Se `cron`, recalcula `next_run_at` para a próxima ocorrência.
- Aciona `notebook_changed` no asyncio Event.
- YAML: `409` (imutável). `404` se inexistente.
- `200` + Job.

### `POST /jobs/group/{group_id}/retry`

Re-enfileira todos os recados em `status=error` vinculados ao `group_id`. `200` → `{ "group_id": "...", "affected": N, "status": "scheduled" }`.

Não há `PATCH` genérico. Recado sqlite: `POST /jobs/{id}/reschedule` ou `POST /jobs/{id}/retry`. YAML: edite o arquivo.

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

## Templates

Catálogo de textos reutilizáveis (SQLite). Sem Jinja. Placeholders no disparo: relógio (`{{date}}`, `{{time}}`, `{{day_name}}`, …) e `{{name}}` do contato cujo `phone` = `target_number`. Tag desconhecida permanece literal. Sem CRUD no MCP (ADR-005).

### Recurso `MessageTemplate`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | string | UUID |
| `name` | string | 1–80, único `NOCASE` |
| `body` | string | Texto com placeholders |

### `GET /templates`

`200` → `{ "templates": [ MessageTemplate ] }` ordenado por nome.

### `POST /templates`

`{ "name": "Bom dia", "body": "Oi {{name}}, hoje é {{date}}." }` → `201`. `409` nome repetido. `422`. `401`.

### `GET /templates/{id}`

`200`. `404`.

### `PATCH /templates/{id}`

Campos opcionais `name` e/ou `body`. `200`. `409` unicidade. `404`.

### `DELETE /templates/{id}`

`204`. `409` se existir job `status=scheduled` com aquele `template_id`. `404`.

## Erros

JSON `{ "detail": ... }` no estilo FastAPI. Não vazar path de SQLite nem API keys.
