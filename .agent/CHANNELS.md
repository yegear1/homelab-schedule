# CHANNELS.md — Canetas no mesmo caderno

O dispatcher interno dispara quando `next_run_at <= now` (ADR-006). Canetas só gravam o caderno e acordam o Event.

Fuso de interpretação humana: `America/Sao_Paulo`. Logs e `next_run_at` na API: UTC.

---

## 1. MCP (agente no Cursor)

Implementação neste repo: `uv run homelab-schedule-mcp` (stdio). Chama a HTTP local (`SCHEDULE_API_URL` + `SCHEDULE_API_KEY`). Não abre SQLite.

| Tool | Papel |
| :--- | :--- |
| `schedule` | Cria. `when` (ISO ou cron humano), `content`, `to` (default `eu`), `title` opcional |
| `list_agenda` | Lista curta: id, when, to, title, status |
| `get_item` | Um id, com `content` |
| `cancel` | Um id (sqlite). YAML → erro explícito “edite routines.yaml” |

Reagendar = `cancel` + `schedule`. Sem `PATCH`. Confirmar ao humano: id, próximo disparo, destino, texto.

Skill do repo: `agenda-job`. Skill de produto (quando o MCP existir): gatilho “anota / me lembra / agenda / o que tem marcado”.

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

O logic-worker chama a HTTP deste serviço (não o gatekeeper). Destino default: JID de quem mandou, mapeado ao alias `eu` se coincidir.

| Comando | Semântica |
| :--- | :--- |
| `!lembra <quando> <texto>` | `POST /jobs` `kind=once` (ou cron se o quando for recorrente) |
| `!agenda <quando> <texto>` | alias de criar (igual `!lembra`) |
| `!agenda` | `GET /jobs?status=upcoming` — lista curta no chat |
| `!cancela <id>` | `POST /jobs/{id}/cancel` |

Resposta no WhatsApp: ecoar id + próximo disparo + texto, como o MCP. Erros 401/422 viram mensagem curta, sem stack.

Auth: o worker usa `SCHEDULE_API_KEY` no env do `whatsapp-api`, não a `WHATSAPP_API_KEY` do gatekeeper.

Este arquivo é a spec. Código do comando: skill `bot-command` no outro repo, depois que `[01.2]` existir.
