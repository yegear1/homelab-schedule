---
name: whatsapp-dispatch
description: Enviar o recado da agenda via gatekeeper POST /send (phone_number, content, x-api-key). 202 queued é sucesso.
---

# Dispatch WhatsApp (`whatsapp-dispatch`)

## 1. Contexto e Objetivo

Único lugar deste repo que chama o gatekeeper. Segue a skill global `whatsapp` e o [ADR-004](../../adr/004-dispatch-gatekeeper.md).

---

## 2. Quando Utilizar

- Cliente HTTP do scheduler ou `POST /jobs/{id}/run`.
- Normalização de alias → JID.
- Retry / tratamento de 401/422/5xx do gatekeeper.

---

## 3. Ferramentas

- Skill global **`whatsapp`** (contrato canônico).
- **CLI:** pytest com httpx mockado. Não dispare WhatsApp real em teste.

---

## 4. Procedimento

### Passo 1: Resolver destino

`WHATSAPP_ALIASES`. Se `to` já termina em `@c.us`/`@g.us`, use. Senão dígitos → `@c.us`. Nunca logar JID como stream field.

### Passo 2: POST

`POST {WHATSAPP_API_URL}/send`

Headers: `Content-Type: application/json`, `x-api-key: {WHATSAPP_API_KEY}`.

Body: `phone_number`, `content`, `quote_id: null`. **Proibido** `to`, `body`, `message`, `Authorization`.

### Passo 3: Interpretar resposta

- `202` + queued → sucesso; grave `last_status=queued` e `message_id` se vier. **Pare.**
- `401` / `422` → não retry cego; `last_error` curto; log `error` NDJSON.
- Rede / 5xx → backoff curto **somente se não houve 202**.

### Passo 4: Não observe entrega

Sem polling no Redis, sem webhook de “delivered” no v1.

---

## 5. Exemplo

```python
payload = {
    "phone_number": normalize_whatsapp_phone(jid),
    "content": content,
    "quote_id": None,
}
response = await client.post(url, headers=headers, json=payload)
if response.status_code == 202:
    return response.json()
response.raise_for_status()
```

---

## 6. Armadilhas

- ⚠️ Retry após 202 duplica a mensagem na fila.
- ⚠️ Misturar `SCHEDULE_API_KEY` com `WHATSAPP_API_KEY`.
- 💡 Timeout do httpx curto (ex. 10s); o 202 é rápido, o envio real não.

---

## 7. Checklist

- [ ] Campos canônicos da skill `whatsapp`
- [ ] 202 = sucesso sem poll
- [ ] Testes com mock, sem rede real
- [ ] Logs NDJSON sem JID como dimensão de stream
