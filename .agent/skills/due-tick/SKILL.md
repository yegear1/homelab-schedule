---
name: due-tick
description: Loop de vencimento da agenda — SELECT next_run_at, dispatch, sleep até o próximo ou Event; catch-up once/cron. Sem APScheduler.
---

# Tick de vencimento (`due-tick`)

## 1. Contexto e Objetivo

O aviso no tempo **não** é um cron daemon. É a coluna `next_run_at` (UTC) + uma coroutine que dorme. Canônico: [ADR-006](../../adr/006-tick-next-run.md).

---

## 2. Quando Utilizar

- Implementar ou alterar o loop de disparo.
- Calcular próxima ocorrência cron no `TZ`.
- Catch-up após o container dormir.
- Ligar `asyncio.Event` nas escritas HTTP/YAML.

---

## 3. Ferramentas

- pytest com relógio injetável (`now` fake) e httpx do gatekeeper mockado.
- Sem APScheduler, Celery, threads de timer extra.

---

## 4. Procedimento

### Passo 1: Relógio no caderno

Ao criar/atualizar job, grave `next_run_at` UTC. `once` = `run_at`. `cron` = próxima parede > agora em `America/Sao_Paulo`.

### Passo 2: Loop

1. Buscar devidos (`<= now`, `scheduled`, `enabled`).
2. Dispatch (`whatsapp-dispatch`). 202 → atualizar status/`next_run_at`.
3. `timeout = min(próximo_next_run - now, 5 minutes)`, nunca busy-loop (`max(0, …)`).
4. `await wait(event, timeout)` — Event nas escritas do caderno.

### Passo 3: Catch-up

- `once` atrasado: um disparo, `done`.
- `cron` atrasado: um disparo, próxima ocorrência **futura** (não replay da série).

### Passo 4: Testes obrigatórios

- Job `once` daqui a 2s dispara sem esperar 5 min (Event).
- Após “viajar” o relógio 8 dias, cron semanal dispara **uma** vez.
- Cancel antes do vencimento → sem POST.

---

## 5. Esqueleto

```python
async def run_tick(stop: asyncio.Event, wake: asyncio.Event) -> None:
    while not stop.is_set():
        await fire_due(utcnow())
        delay = seconds_until_next_or_cap(cap=300)
        try:
            await asyncio.wait_for(wake.wait(), timeout=delay)
        except TimeoutError:
            pass
        wake.clear()
```

---

## 6. Armadilhas

- ⚠️ POST /jobs sem `wake.set()` → aviso até 5 min tarde.
- ⚠️ Guardar `next_run_at` em horário de Brasília **sem** converter a UTC.
- ⚠️ Replay de cron atrasado (N mensagens).
- 💡 Run-now não zera o `once` futuro.

---

## 7. Checklist

- [ ] Índice / query devidos
- [ ] Event nas escritas
- [ ] Teste +2s e teste coalesce cron
- [ ] Sem APScheduler
