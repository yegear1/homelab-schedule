# CHANNELS.md — Canetas no mesmo caderno

O dispatcher interno dispara quando `next_run_at <= now` (ADR-006). Canetas só gravam o caderno e acordam o Event.

Fuso de interpretação humana: `America/Sao_Paulo`. Logs e `next_run_at` na API: UTC.

---

## 1. MCP (agente no Cursor)

Implementação neste repo: `uv run homelab-schedule-mcp` (stdio). Chama a HTTP local (`SCHEDULE_API_URL` + `SCHEDULE_API_KEY`). Não abre SQLite.

| Tool | Papel |
| :--- | :--- |
| `schedule` | Cria. `when` (ISO-8601, cron de 5 campos, intervalo relativo `+15m`/`2h`/`em 10 minutos` ou amigável `amanhã 14h`/`hoje 18:00`), `content`, `to` (default `eu`), `title` opcional, `variables` (dicionário chave-valor opcional) |
| `list_agenda` | Lista curta: id, when, to, title, status (filtros opcionais `status`, `limit`, `to`, `query` textual e `period` relativo como 'hoje', 'amanhã', 'esta semana', '7d') |
| `get_item` | Um id, com `content`, `source`, `variables` e metadados |
| `cancel` | Um id (sqlite). YAML → erro explícito “edite routines.yaml” |
| `reschedule` | Reativa/adia recado (`when` novo: ISO, cron, intervalo relativo `+2h` ou amigável `amanhã 10h`) com mesmo id |
| `preview` | Dry-run / simulação sem persistência: resolução de destinatário, cálculo de `next_run_at` (UTC e local) e renderização prévia de variáveis nativas (`{{name}}`, `{{date}}`, etc.) e customizadas (`variables`) |

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
  content: "Status do backup do {{servidor}}."
  variables:
    servidor: "Proxmox Node 1"
```

- `id` estável: chave de merge. Editar o YAML atualiza o job lógico; apagar o id desativa a rotina.
- `when`: cron de cinco campos no `TZ` da app (v1). Não misturar `once` no YAML — pontual é SQLite.
- `variables`: dicionário opcional de variáveis customizadas estáticas injetadas na interpolação do disparo.
- Loader no boot (watch em runtime é débito).
- `DELETE /jobs/{id}` em fonte yaml → `409`.

Callers externos (bots, scripts) usam a HTTP deste serviço. Este repositório não define comandos de chat nem implementa cliente de mensageiro.
