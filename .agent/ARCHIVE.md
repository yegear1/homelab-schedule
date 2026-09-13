# ARCHIVE.md — Arquivo Histórico de Tarefas Concluídas

> Lotes arquivados após tag Git (ou quando o log do `TASK.md` passar de ~15 linhas).
> Cabeçalho canônico: `## [vX.Y.Z] - AAAA-MM-DD`. Detalhe: `git log`.

---

## [v0.2.0] - 2026-09-12

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [02.4] | Fechar lacunas do `AGENTS.md` vs `victorialogs-integration` | [`d529b25`] | 2026-09-12 |
| [02.3] | Retentativas de disparo para falhas transitórias do gateway | [`1f2eb5a`] | 2026-09-11 |
| [02.2] | Templates dinâmicos de mensagem no disparo (placeholders de data/hora) | [`a6c2535`] | 2026-09-11 |
| [02.1] | Filtros e paginação na listagem do MCP (status e limit) | [`6f00be3`] | 2026-09-11 |
| [01.4] | Housekeeping e expurgo automático de jobs antigos no SQLite | [`2de02f1`] | 2026-09-11 |
| [01.3] | Watch / Reload de `routines.yaml` em runtime via `/routines/reload` e mtime | [`223ac9b`] | 2026-09-11 |
| [01.2] | Suporte a `reschedule` / `snooze` de recados pontuais no MCP e HTTP | [`ddb85e1`] | 2026-09-11 |
| [01.1] | Persistir `target_number` normalizado no job e documentar gateway agnóstico | [`33fe49b`] | 2026-09-11 |

## [v0.1.0] - 2026-09-11

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [02.4] | Skill Cursor de anotação (quando usar MCP) | [`e89d7b7`] | 2026-09-11 |
| [02.3] | Compose slim + logs NDJSON stdlib | [`c41ff51`] | 2026-09-11 |
| [02.2] | MCP stdio (quatro tools) | [`d212d6d`] | 2026-09-11 |
| [02.1] | Loader `routines.yaml` (merge por `id` estável) | [`4d95ec6`] | 2026-09-11 |
| [01.3] | Tick `next_run_at` + cliente gatekeeper | [`e32910b`] | 2026-09-11 |
| [01.2] | HTTP `/health` e `/jobs` (CRUD mínimo + run now + Event) | [`9d35bbe`] | 2026-09-11 |
| [01.1] | Modelo de job + sqlite3 WAL + `CREATE TABLE` no connect | [`37073f3`] | 2026-09-11 |
| [00.1] | Bootstrap UV, pyproject, ruff, mypy, pytest e layout `src/` | [`303a9c8`] | 2026-09-11 |
| [00.0.1] | Constituição do produto, contratos e ADRs | [`a9d1766`] [`671ba19`] | 2026-09-11 |
| [00.0] | Scaffolding inicial (ADD greenfield) | [`2c7ba79`] | 2026-09-11 |
