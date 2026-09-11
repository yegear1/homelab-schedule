# [ADR-002] SQLite WAL para recados e YAML para rotinas

- **Status:** Aprovado
- **Data:** 2026-09-11
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

Há dois tipos de anotação: recado pontual (“amanhã 14h, condomínio”) e política permanente (“toda segunda, status do backup”). Um único SQLite mistura o que deveria ser git com o que deveria ser chat. Só YAML não serve para o MCP criar pontuais.

## 2. Decisão Tomada

- **SQLite 3 WAL** (`DATABASE_PATH` em volume): jobs criados por MCP/HTTP (`source=sqlite`).
- **`routines.yaml`** (`ROUTINES_PATH`): rotinas com `id` estável; merge no boot; `source=yaml`.
- Schema: `CREATE TABLE IF NOT EXISTS` no connect (sem Alembic). Pontual `once` marca `done` após disparo ok; cron permanece com novo `next_run_at`.

## 3. Alternativas Consideradas

- **Só SQLite:** rotinas do homelab somem do git e não sobrevivem a volume novo.
- **Só YAML:** o agente não tem caneta pontual segura (editar git a cada lembrete).
- **PostgreSQL:** peso demais para um Mini PC e um writer.

## 4. Consequências e Trade-offs

### Positivas

- Recado vs política têm ciclo de vida certo.
- Backup: volume (sqlite) + git (yaml).

### Negativas / Riscos Assumidos

- Merge YAML precisa de `id` estável; conflito de id sqlite vs yaml deve ser rejeitado.
- Watch do YAML em runtime ficou como débito (reload no boot no v1).
- Cancel HTTP de yaml → `409` (edite o arquivo).

## 5. Referências e Links

- `whatsapp-api` ADR-006 (SQLite WAL)
- `.agent/CHANNELS.md`
