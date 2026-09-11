# [ADR-004] Dispatch apenas via gatekeeper POST /send

- **Status:** Aprovado
- **Data:** 2026-09-11
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

A agenda precisa mandar WhatsApp. A calha já existe: `gatekeeper-py` valida, enfileira no Redis e o gateway aplica typing/anti-ban. Recriar envio aqui duplicaria ban-risk e contratos.

## 2. Decisão Tomada

O scheduler só faz HTTP `POST {WHATSAPP_API_URL}/send` com:

- Header `x-api-key: {WHATSAPP_API_KEY}`
- JSON `phone_number` (JID normalizado `@c.us` / `@g.us`), `content`, `quote_id` null

`202` + `status: queued` = sucesso do job (`last_status=queued`). Não poll. Não reenviar imediatamente. Falha de rede/401/422: log `error` NDJSON, retry curto com backoff **só se não houve 202**. Alias resolve para JID antes do POST.

## 3. Alternativas Consideradas

- **Falar com Redis da WhatsApp API:** acoplamento e fura o gatekeeper.
- **whatsapp-web.js neste container:** Puppeteer pesado; fora do recorte “leve”.

## 4. Consequências e Trade-offs

### Positivas

- Anti-ban continua num só lugar.
- Skill `whatsapp` e cliente drop-in (httpx) reutilizáveis.

### Negativas / Riscos Assumidos

- Se o gatekeeper estiver fora, o job falha mesmo com a agenda saudável — `502` em run-now; scheduler registra `last_error`.
- Entrega real (lido/enviado no WhatsApp) **não** é observada aqui.

## 5. Referências e Links

- Skill global `whatsapp` (`~/.cursor/skills/whatsapp/SKILL.md`)
- `.agent/skills/whatsapp-dispatch/SKILL.md`
