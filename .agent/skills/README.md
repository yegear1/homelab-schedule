# Skills do projeto

Procedimentos passo a passo. Regras ficam no `AGENTS.md`; decisões no `NOTES.md`.

## Catálogo

| Skill | Arquivo | Quando |
| :--- | :--- | :--- |
| **`database-migration`** | [`database-migration/SKILL.md`](./database-migration/SKILL.md) | Schema sqlite3 no connect (sem Alembic) |
| **`api-endpoint`** | [`api-endpoint/SKILL.md`](./api-endpoint/SKILL.md) | Rotas HTTP: router → service → repository |
| **`mcp-tool`** | [`mcp-tool/SKILL.md`](./mcp-tool/SKILL.md) | Tools do MCP stdio (superfície fechada) |
| **`anotar-agenda`** | [`anotar-agenda/SKILL.md`](./anotar-agenda/SKILL.md) | Anotar / listar / cancelar via MCP (pedido humano) |
| **`agenda-job`** | [`agenda-job/SKILL.md`](./agenda-job/SKILL.md) | Contrato de campos do job (when/to/content) |
| **`whatsapp-dispatch`** | [`whatsapp-dispatch/SKILL.md`](./whatsapp-dispatch/SKILL.md) | POST gatekeeper `/send`; 202 = sucesso |
| **`due-tick`** | [`due-tick/SKILL.md`](./due-tick/SKILL.md) | Loop `next_run_at` + Event |

Skills globais (não copiar para cá): `whatsapp`, `victorialogs-integration`, `victorialogs-troubleshooting`, `github-bug-issue`.

## Nova skill

1. `mkdir -p .agent/skills/<nome> && cp .agent/skills/000-template.md .agent/skills/<nome>/SKILL.md`
2. Preencha `name` / `description` e o procedimento.
3. Liste no `AGENTS.md`. Fluxo de host (logs, hypervisor) é skill **global**, não deste repo.
