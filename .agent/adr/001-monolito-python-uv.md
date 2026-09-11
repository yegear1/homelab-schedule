# [ADR-001] Monólito Python: FastAPI + tick SQLite, UV, 3.13

- **Status:** Aprovado
- **Data:** 2026-09-11
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

Agenda em um container: POSTs no gatekeeper, jobs pontuais e cron, sem Celery/n8n/fila extra. Homelab Python já usa UV e 3.13+. Foco: simplicidade e ociosidade barata (Mini PC).

## 2. Decisão Tomada

Um **único processo**: FastAPI (HTTP) + **tick asyncio** (disparos) + sqlite3 WAL. **UV** apenas. Python **3.13+**. Sem Redis, **sem APScheduler**, **sem Alembic**, **sem Loguru** (NDJSON via `logging` stdlib). Schema: `CREATE TABLE IF NOT EXISTS` no connect. Imagem: `python:3.13-slim`, um worker uvicorn, deps de teste fora da imagem.

Relógio: [ADR-006](006-tick-next-run.md).

## 3. Alternativas Consideradas

- **APScheduler:** segunda verdade em memória, sync com cancel/YAML.
- **Alembic:** histórico de schema para uma tabela.
- **crontab / Ofelia:** ruim para pontual e MCP.
- **Celery Beat / dois containers:** peso e dois writers SQLite.

## 4. Consequências e Trade-offs

### Positivas

- RAM ~40–80 MB idle; CPU ~0% entre ticks.
- Uma verdade: `next_run_at` no SQLite.

### Negativas / Riscos Assumidos

- Container parado → jobs atrasam até subir (catch-up no ADR-006).
- Primeiro ALTER de coluna é SQL no código, não revision.

## 5. Referências e Links

- [UV](https://docs.astral.sh/uv/)
- [ADR-006](006-tick-next-run.md)
