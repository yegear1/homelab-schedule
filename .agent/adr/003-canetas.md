# [ADR-003] Quatro canetas, um caderno

- **Status:** Aprovado
- **Data:** 2026-09-11
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

O humano quer anotar de várias superfícies (agente, script, rotina git, celular) sem calendário, e-mail ou UI web. O risco é cada canal virar um produto.

## 2. Decisão Tomada

Canetas autorizadas:

1. **MCP** — caneta do agente (v1 neste repo).
2. **HTTP** — caneta de máquina e backend do MCP (v1).
3. **YAML** — caneta de rotina permanente (v1).
4. **WhatsApp** (`!lembra` / `!agenda` / `!cancela`; `!agenda all` só admin) — caneta humana no celular; **só contrato** neste repo (`.agent/CHANNELS.md`); código no `whatsapp-api`. Comandos pessoais escopam pelo remetente; a chave de máquina não substitui esse filtro.

Fora de escopo v1: UI web, CalDAV, e-mail, Telegram, issues GitHub como fila de lembrete.

Destinos: alias (`eu`, `grupo-homelab`) via `WHATSAPP_ALIASES`. Default `to=eu`.

## 3. Alternativas Consideradas

- **Só MCP:** inútil no celular e em scripts.
- **Implementar o bot neste repo:** duplicaria o brain; o WhatsApp já entra pelo outro serviço.
- **Google Calendar:** auth e sync; não é o caderno.

## 4. Consequências e Trade-offs

### Positivas

- Um modelo de job; três implementações de escrita no v1.
- Bot futuro é cliente HTTP, não segundo scheduler.

### Negativas / Riscos Assumidos

- Até o `whatsapp-api` implementar o comando, anotar no celular não existe.
- Dois `x-api-key` no homelab (`SCHEDULE_API_KEY` vs `WHATSAPP_API_KEY`) — documentar no `.env.example` para agentes não misturarem.
- Worker com `SCHEDULE_API_KEY` ainda lê o caderno inteiro; vazamento de lista global é bug do comando se `!agenda` (sem `all`) não filtrar pelo remetente.

## 5. Referências e Links

- `.agent/CHANNELS.md`
- skill global `whatsapp`
