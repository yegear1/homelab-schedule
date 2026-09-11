# Skills do projeto

Procedimentos passo a passo. Regras ficam no `AGENTS.md`; decisões no `NOTES.md`.

## Catálogo

| Skill | Arquivo | Quando |
| :--- | :--- | :--- |
| **`database-migration`** | [`database-migration/SKILL.md`](./database-migration/SKILL.md) | Migrations com expand/contract e rollback |
| **`api-endpoint`** | [`api-endpoint/SKILL.md`](./api-endpoint/SKILL.md) | Rotas HTTP: router → service → repository |

Apague a pasta se o projeto não usar banco ou API HTTP. Adapte exemplos à stack real.

## Nova skill

1. `mkdir -p .agent/skills/<nome> && cp .agent/skills/000-template.md .agent/skills/<nome>/SKILL.md`
2. Preencha `name` / `description` e o procedimento.
3. Liste no `AGENTS.md`. Fluxo de host (logs, hypervisor) é skill **global**, não deste repo.
