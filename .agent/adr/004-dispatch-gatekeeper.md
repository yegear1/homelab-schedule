# [ADR-004] Dispatch apenas via POST /send no gateway configurado

- **Status:** Aprovado (sanitizado 2026-09-12 para publicação)
- **Data:** 2026-09-11
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

A agenda precisa entregar o recado no horário. Embutir cliente de mensageiro, fila Redis ou sessão de chat neste container duplicaria peso e contratos. O envio fica num HTTP que o operador aponta em `WHATSAPP_API_URL`.

## 2. Decisão Tomada

O scheduler só faz HTTP `POST {WHATSAPP_API_URL}/send` com:

- Header `x-api-key: {WHATSAPP_API_KEY}`
- JSON `phone_number` (destino normalizado), `content`, `quote_id` opcional

`202` + `status: queued` = sucesso do job (`last_status=queued`). Não poll. Não reenviar imediatamente. Falha de rede/401/422: log `error` NDJSON; retry com backoff **só se não houve 202** (erros permanentes falham na hora). Alias resolve para `target_number` no create; o tick usa esse valor.

## 3. Alternativas Consideradas

- **Fila compartilhada / Redis do outro serviço:** acoplamento.
- **whatsapp-web.js / browser neste container:** Puppeteer pesado; fora do recorte “leve”.

## 4. Consequências e Trade-offs

### Positivas

- Este repo permanece um caderno + tick.
- Cliente httpx drop-in; qualquer gateway com o payload canônico serve.

### Negativas / Riscos Assumidos

- Se o gateway estiver fora, o job falha mesmo com a agenda saudável — `502` em run-now; scheduler registra `last_error`.
- Entrega real ao destinatário **não** é observada aqui.

## 5. Referências e Links

- `.agent/skills/whatsapp-dispatch/SKILL.md`
