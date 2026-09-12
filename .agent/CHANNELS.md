# CHANNELS.md — Canetas no mesmo caderno

O dispatcher interno dispara quando `next_run_at <= now` (ADR-006). Canetas só gravam o caderno e acordam o Event.

Fuso de interpretação humana: `America/Sao_Paulo`. Logs e `next_run_at` na API: UTC.

---

## 1. MCP (agente no Cursor)

Implementação neste repo: `uv run homelab-schedule-mcp` (stdio). Chama a HTTP local (`SCHEDULE_API_URL` + `SCHEDULE_API_KEY`). Não abre SQLite.

| Tool | Papel |
| :--- | :--- |
| `schedule` | Cria. `when` (ISO ou cron humano), `content`, `to` (default `eu`), `title` opcional |
| `list_agenda` | Lista curta: id, when, to, title, status (filtros opcionais `status`: upcoming/done/error/paused/all, e `limit`) |
| `get_item` | Um id, com `content` |
| `cancel` | Um id (sqlite). YAML → erro explícito “edite routines.yaml” |
| `reschedule` | Reativa/adia recado (`when` novo) com mesmo id |

Skill do operador no Cursor: [`anotar-agenda`](skills/anotar-agenda/SKILL.md). Contrato de campos: [`agenda-job`](skills/agenda-job/SKILL.md).

---

## 2. HTTP

Contrato: [ENDPOINTS.md](ENDPOINTS.md). Auth `x-api-key` = `SCHEDULE_API_KEY`. Canal de máquinas e do próprio MCP.

---

## 3. YAML de rotinas (`ROUTINES_PATH`)

Jobs **permanentes** do homelab. Versionáveis. Não nascem de um chat.

```yaml
# routines.yaml
- id: backup-status
  title: backup-status
  when: "0 9 * * 1"
  to: grupo-homelab
  content: "Status do backup."
```

- `id` estável: chave de merge. Editar o YAML atualiza o job lógico; apagar o id desativa a rotina.
- `when`: cron de cinco campos no `TZ` da app (v1). Não misturar `once` no YAML — pontual é SQLite.
- Loader no boot (watch em runtime é débito).
- `DELETE /jobs/{id}` em fonte yaml → `409`.

---

## 4. WhatsApp — contrato para o `whatsapp-api` (não implementar neste repo)

O logic-worker chama a HTTP deste serviço (não o gatekeeper). A `SCHEDULE_API_KEY` no worker é chave de máquina (vê o caderno inteiro). **Isolamento é da caneta**, não da API: comandos pessoais só operam jobs do remetente.

### Escopo por número

- **Criar:** `to` = JID de quem mandou; se esse JID for o valor do alias `eu` em `WHATSAPP_ALIASES`, pode gravar `to=eu` (o servidor preenche `target_number`).
- **Listar / cancelar (não-admin):** só jobs cujo `target_number` (JID normalizado) é o remetente, **ou** cujo `to` é um alias que resolve para esse JID. Rotinas YAML para `grupo-homelab` (ou outro destino) **não** aparecem no `!agenda` privado.
- **Não** passar o JID no query `to` de `GET /jobs` — nesse endpoint `to` é **fim de intervalo de data** (ISO). Até existir filtro `destination` na API: `GET /jobs?status=upcoming` e filtrar no worker.
- `ADMIN_ONLY` **não** vale nos comandos pessoais (`!lembra`, `!agenda`, `!cancela`). Qualquer membro pode anotar **a própria** agenda.

### Comandos

| Comando | Quem | Semântica |
| :--- | :--- | :--- |
| `!lembra <quando> <texto>` | qualquer um | `POST /jobs` `kind=once` (ou cron se o quando for recorrente), `to` = remetente |
| `!agenda <quando> <texto>` | qualquer um | igual `!lembra` |
| `!agenda` | qualquer um | lista curta **só** dos jobs do remetente (`upcoming`) |
| `!agenda all` | **admin only** (mesmo gate de `!send` / `!status`) | lista curta **global** (`GET /jobs?status=upcoming` sem filtro de destino). Visão ops; inclui YAML/homelab |
| `!cancela <id>` | qualquer um | `POST /jobs/{id}/cancel` **somente** se o job for do remetente; senão responder como não encontrado (não vazar que o id existe). Cancelar job alheio ou YAML: MCP/HTTP, não o chat |

Resposta no WhatsApp: ecoar id + próximo disparo + texto, como o MCP. Erros 401/422 viram mensagem curta, sem stack.

Auth: o worker usa `SCHEDULE_API_KEY` no env do `whatsapp-api`, não a `WHATSAPP_API_KEY` do gatekeeper.

Este arquivo é a spec. Código do comando: skill `bot-command` no outro repo.
