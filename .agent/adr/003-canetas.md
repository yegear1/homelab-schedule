# [ADR-003] Três canetas neste repo, um caderno

- **Status:** Aprovado (sanitizado 2026-09-12 para publicação)
- **Data:** 2026-09-11
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

O humano quer anotar de várias superfícies (agente, script, rotina git) sem calendário, e-mail ou UI web. O risco é cada canal virar um produto.

## 2. Decisão Tomada

Canetas **neste repositório**:

1. **MCP** — caneta do agente.
2. **HTTP** — caneta de máquina e backend do MCP.
3. **YAML** — caneta de rotina permanente.

Fora de escopo neste repo: UI web, CalDAV, e-mail, Telegram, bots de chat, issues GitHub como fila de lembrete. Um bot ou outro serviço pode ser **caller HTTP** (`/jobs`); o código não mora aqui.

Destinos: alias (`eu`, …) via `WHATSAPP_ALIASES` (nome histórico da env). Default `to=eu`.

## 3. Alternativas Consideradas

- **Só MCP:** inútil em scripts e automações.
- **Cliente de mensageiro neste container:** duplicaria fila, sessão e anti-ban; o scheduler só agenda e faz `POST /send`.
- **Google Calendar:** auth e sync; não é o caderno.

## 4. Consequências e Trade-offs

### Positivas

- Um modelo de job; três escritas versionadas neste repo.
- Integrações futuras são clientes HTTP, não segundo scheduler.

### Negativas / Riscos Assumidos

- Anotar pelo celular exige um caller externo (não documentado neste git).
- Duas chaves: `SCHEDULE_API_KEY` (esta API) vs `WHATSAPP_API_KEY` (gateway de envio). Não misturar.

## 5. Referências e Links

- `.agent/CHANNELS.md`
- `.agent/skills/whatsapp-dispatch/SKILL.md`
