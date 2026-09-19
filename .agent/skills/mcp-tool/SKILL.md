---
name: mcp-tool
description: Adicionar ou alterar tools do MCP stdio do homelab-schedule sem abrir CRUD genérico nem inflar tokens.
---

# Tools MCP (`mcp-tool`)

## 1. Contexto e Objetivo

O MCP é caneta do agente, não um segundo OpenAPI. Superfície fechada: [ADR-005](../../adr/005-mcp-superficie-fechada.md).

---

## 2. Quando Utilizar

- Criar/alterar tool stdio.
- Mudar schema JSON de input/output do MCP.
- Mapear tool → HTTP.

---

## 3. Ferramentas

- **MCP:** o próprio servidor, depois de existir.
- **CLI:** pytest do parser/cliente HTTP mockado; não precisa do Cursor para unit test.

---

## 4. Procedimento

### Passo 1: Precisa de tool nova?

Default: **não**. Quatro tools (`schedule`, `list_agenda`, `get_item`, `cancel`). `reschedule` só se o backlog futuro for promovido. `PATCH` é proibido.

### Passo 2: Schema mínimo

- Input: campos que o humano já usa (`when`, `content`, `to`, `title`, `id`).
- Output de lista: sem `content` longo.
- Erro: string curta (401, yaml imutável, API fora).

### Passo 3: Só HTTP

O processo MCP não abre SQLite. `SCHEDULE_API_URL` + `SCHEDULE_API_KEY`. Falha de conexão → mensagem “API homelab-schedule indisponível em …”.

### Passo 4: Tokens

Uma linha JSON-RPC por resposta. Sem pretty-print de 50 jobs. Paginar ou limitar `list_agenda` (ex. 50).

### Passo 5: Docs

Atualize `.agent/CHANNELS.md` e a skill `agenda-job` se a semântica mudar.

---

## 5. Exemplo de descrição de tool

```json
{
  "name": "schedule",
  "description": "Cria um job na agenda. when é ISO-8601, cron de 5 campos, intervalo relativo (+15m, 2h, em 10 minutos) ou data amigável (amanhã 14h, hoje 18:00, segunda 9h). to é alias (default eu).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "when": { "type": "string" },
      "content": { "type": "string" },
      "to": { "type": "string" },
      "title": { "type": "string" }
    },
    "required": ["when", "content"]
  }
}
```

---

## 6. Armadilhas

- ⚠️ Não encaminhar o body do `/send` (`phone_number`) no MCP.
- ⚠️ Não versionar `.cursor/mcp.json`.
- 💡 Confirme `next_run_at` no retorno do `schedule`.

---

## 7. Checklist

- [ ] Tool está na lista das quatro (ou débito documentado)
- [ ] Chamada só HTTP
- [ ] Lista curta
- [ ] CHANNELS.md alinhado
