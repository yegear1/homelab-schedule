---
name: anotar-agenda
description: >
  Use when the human asks to annotate, remind, schedule, list, cancel, or
  reschedule a reminder (anota, me lembra, agenda, o que tem marcado,
  cancela, adia, remarca). Call MCP homelab-schedule tools; never POST /send or invent crontab.
---

# Anotar na agenda via MCP (`anotar-agenda`)

## 1. Contexto e Objetivo

O humano fala em português. O caderno é estruturado. Esta skill é a **caneta do agente no Cursor**: gravar, listar, cancelar e remarcar pelo MCP `homelab-schedule`, sem curl ad-hoc e sem `POST /send`.

Contrato de campos: skill [`agenda-job`](../agenda-job/SKILL.md). Canais: [CHANNELS.md](../CHANNELS.md). Tools: [ADR-005](../adr/005-mcp-superficie-fechada.md).

---

## 2. Quando Utilizar (Gatilhos)

Ative sempre que o humano (ou a tarefa) pedir para:

- anotar, me lembra, agenda, marcar um recado
- o que tem marcado, o que tem na agenda, listar lembretes
- cancela o lembrete, desmarca, não precisa mais
- adia o recado, remarca, muda o horário para mais tarde

**Não** use para: implementar o servidor MCP (`mcp-tool`); alterar schema SQLite; enviar a mensagem na hora (`whatsapp-dispatch`); bug de outro app (`github-bug-issue`); rotina permanente (aí é YAML).

---

## 3. Ferramentas e Servidores MCP Relacionados

- **MCP:** `homelab-schedule` stdio — `schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`. A API HTTP tem de estar no ar (`uv run uvicorn …` ou Compose). `.cursor/mcp.json` é local, não versionado.
- **HTTP:** só se o MCP não estiver configurado no Cursor — mesmos campos, [ENDPOINTS.md](../ENDPOINTS.md), header `x-api-key: SCHEDULE_API_KEY`.
- **Nunca:** `WHATSAPP_API_KEY`, `POST /send`, SQLite direto, `PATCH`.

Mutação em produção via MCP só com consentimento do humano (`AGENTS.md`).

---

## 4. Procedimento Operacional Passo a Passo

### Passo 1: Escolher a caneta

| Pedido | Caneta |
| :--- | :--- |
| Recado pontual ou cron ad-hoc (“amanhã 14h”, “toda segunda 9h”) | MCP `schedule` |
| Adiar ou remarcar recado pontual (“adia em 2h”, “remarca para amanhã 10h”) | MCP `reschedule` |
| Política permanente (backup, status semanal no git) | Editar `routines.yaml` (id estável); não SQLite |

### Passo 2: Extrair quatro campos

1. **when** — ISO-8601 com offset (fuso default `America/Sao_Paulo`) ou cron de **cinco** campos. Se estiver ambíguo, **uma** pergunta; não grave.
2. **content** — texto da mensagem.
3. **to** — default `eu`; alias conhecido ou destino normalizado. Não peça id cru se o alias existir.
4. **title** — uma linha; se faltar, o servidor deriva do content.

### Passo 3: Chamar a tool e confirmar

- Criar: `schedule` (`when`, `content`, `to`, `title` opcional).
- Listar: `list_agenda` (lista curta, sem `content`; aceita `status: upcoming|done|error|paused|all` e `limit`).
- Detalhe: `get_item` com o `id`.
- Cancelar sqlite: `cancel` + `id`. YAML → diga para editar `routines.yaml`.
- Remarcar/adiar sqlite: `reschedule` (`job_id`, `when`). YAML → edite `routines.yaml`.

**A tarefa só acaba** quando você devolver ao humano: `id`, próximo disparo em BRT **e** UTC, `to`, `title`/`content`.

Se a tool responder `API homelab-schedule indisponível`, suba a API; não invente o job.

---

## 5. Padrões de Código e Exemplos Canônicos

Humano: *“Amanhã 14h me manda pagar condomínio.”*

MCP `schedule`:

```json
{
  "when": "2026-09-12T14:00:00-03:00",
  "to": "eu",
  "title": "condomínio",
  "content": "Pagar condomínio."
}
```

Resposta ao humano: gravado `<id>`, dispara sábado 12/09 14:00 BRT (17:00 UTC), destino `eu`, texto “Pagar condomínio.”

---

## 6. Armadilhas Conhecidas e Anti-Padrões

- ⚠️ **NÃO FAÇA:** `POST /send` “para ver se funciona”; payload `phone_number` no MCP; cron `* * * * *` de teste em produção; `PATCH`; curl se o MCP estiver no ar.
- ⚠️ **NÃO FAÇA:** copiar rotina YAML para o SQLite e esquecer o arquivo.
- 💡 **FAÇA:** quatro tools só; confirmação com `next_run_at`; YAML imutável via HTTP/MCP → edite o arquivo.

---

## 7. Checklist de Conclusão da Skill

- [ ] Caneta certa (MCP sqlite vs `routines.yaml`)
- [ ] `when` / `to` / `content` resolvidos (ou uma pergunta)
- [ ] Confirmação: id + próximo disparo BRT e UTC + destino + texto
- [ ] Sem `POST /send` e sem token nos logs
