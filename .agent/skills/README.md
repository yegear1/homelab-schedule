# Skills do projeto

Especificações canônicas e procedimentos passo a passo estruturados no padrão de 9 seções. Regras globais residem no `AGENTS.md`; decisões arquiteturais no `NOTES.md`.

## Catálogo

| Skill | Arquivo | Escopo & Quando Utilizar |
| :--- | :--- | :--- |
| **`agenda-job`** | [`agenda-job/SKILL.md`](./agenda-job/SKILL.md) | Extração de campos (`when`, `content`, `to`, `title`), fuso `America/Sao_Paulo`, dry-run e confirmação |
| **`anotar-agenda`** | [`anotar-agenda/SKILL.md`](./anotar-agenda/SKILL.md) | Caneta MCP stdio de superfície fechada (`schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`, `pause`, `resume`, `snooze`) |
| **`api-endpoint`** | [`api-endpoint/SKILL.md`](./api-endpoint/SKILL.md) | Endpoints FastAPI com separação estrita (router → service → repository) e Pydantic v2 |
| **`database-migration`** | [`database-migration/SKILL.md`](./database-migration/SKILL.md) | Migrações SQLite no connect via `PRAGMA user_version` e WAL mode, sem Alembic |
| **`due-tick`** | [`due-tick/SKILL.md`](./due-tick/SKILL.md) | Loop asyncio guiado por `next_run_at` UTC e `notebook_changed`, cap 300s, sem APScheduler |
| **`mcp-tool`** | [`mcp-tool/SKILL.md`](./mcp-tool/SKILL.md) | Servidor MCP stdio com ponte HTTP para a API local, densidade de tokens, sem conexão SQLite direta |
| **`whatsapp-dispatch`** | [`whatsapp-dispatch/SKILL.md`](./whatsapp-dispatch/SKILL.md) | Despacho via `POST /send` (`phone_number`, `content`, `x-api-key`), `202 Accepted` definitivo sem polling |

Skills globais (não versionadas neste repositório): `victorialogs-integration`, `victorialogs-troubleshooting`, `github-bug-issue`.

## Nova skill

1. `mkdir -p .agent/skills/<nome> && cp .agent/skills/000-template.md .agent/skills/<nome>/SKILL.md`
2. Preencha `name`, `description` ($\le 250$ caracteres) e as 9 seções canônicas.
3. Liste a nova skill na tabela de skills do `AGENTS.md` e neste README.
