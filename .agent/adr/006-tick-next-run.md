# [ADR-006] Avisos no tempo: `next_run_at` + tick asyncio

- **Status:** Aprovado
- **Data:** 2026-09-11
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

Sem APScheduler não há trigger in-memory. Precisamos disparar WhatsApp na hora certa com um processo ocioso, SQLite como relógio, e acordar se o humano anotar um recado daqui a dois minutos enquanto o loop “dormia” até segunda.

## 2. Decisão Tomada

Cada job tem **`next_run_at` em UTC** (índice). O tick **não** é “cron interno”: é dormir até o próximo vencimento.

```text
loop:
  1. SELECT jobs WHERE enabled AND status=scheduled AND next_run_at <= now
  2. para cada um: POST /send; se 202:
       once  → status=done, next_run_at=NULL
       cron  → next_run_at = próxima ocorrência ESTRITAMENTE > now (TZ America/Sao_Paulo)
  3. t = MIN(next_run_at) dos scheduled
  4. await wait(timeout=min(t-now, 5min), OU evento "caderno mudou")
```

**Evento:** `POST /jobs`, cancel, run-now e merge YAML setam `asyncio.Event`. Assim um recado “daqui 90s” não espera o cap de 5 min.

**Cap 5 min:** relógio do host, DST, NTP. Sem busy-loop.

**Criação:**
- `once`: `next_run_at = run_at` convertido a UTC (`TZ` se o ISO vier sem offset).
- `cron`: cinco campos no fuso `America/Sao_Paulo`; grava a próxima ocorrência futura em UTC.

**Atraso (container dormiu):**
- `once` vencido e ainda `scheduled` → dispara **uma** vez no próximo tick (o aviso atrasado ainda vale).
- `cron` com N períodos perdidos → dispara **uma** vez (coalesce), depois pula para a próxima futura. Não manda 12 “segunda 9h” atrasadas.

**Run now:** POST gatekeeper imediato; **não** altera `next_run_at` do `once` futuro.

**Precisão:** da ordem de centenas de ms após o sleep acordar — suficiente para lembrete humano. O delay 10–35s do gateway WhatsApp domina a percepção de “chegou”.

Não usar `SELECT` a cada 30s fixos como desenho principal (jitter inútil). Poll fixo só se o Event falhar nos testes — aí documentar.

## 3. Alternativas Consideradas

- **Sleep fixo 30s:** mais simples, atraso médio 15s; rejeitado como *principal* porque o Event + `MIN(next_run_at)` é pouco código a mais e acerta “daqui 2 min”.
- **APScheduler:** descartado (ADR-001).
- **systemd timer no host:** fora do container.

## 4. Consequências e Trade-offs

### Positivas

- CPU idle real (sleep da event loop).
- HTTP/MCP só escrevem o caderno; o tick é o único disparo agendado.

### Negativas / Riscos Assumidos

- Esquecer o Event no `POST /jobs` → atraso até o cap (5 min). Teste obrigatório: criar job +2s e assert dispatch sem esperar 5 min.
- Cron DST (ex. 2:30 inexistente no horário de verão antigo): usar `zoneinfo`; se a parede pular, próxima ocorrência válida. Brasil sem DST hoje; ainda assim UTC no banco.

## 5. Referências e Links

- `.agent/ENDPOINTS.md` (`next_run_at`)
- `.agent/skills/due-tick/SKILL.md`
