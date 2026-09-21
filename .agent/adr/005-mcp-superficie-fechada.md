# [ADR-005] MCP com superfície fechada

- **Status:** Aprovado
- **Data:** 2026-09-11
- **Atualizado:** 2026-09-12 (`reschedule` entrou na superfície), 2026-09-19 (`preview` adicionada para dry-run), 2026-09-20 (`pause`, `resume`, `snooze` adicionados para ciclo de vida)
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

Agentes alucinam crontab e PATCH genérico. A agenda precisa de poucas tools e respostas curtas: listar o marcado e gravar recado sem CRUD REST no protocolo MCP.

## 2. Decisão Tomada

Servidor MCP **stdio**, Python, chamando a HTTP local (não abre SQLite direto). Tools:

1. `schedule`
2. `list_agenda`
3. `get_item`
4. `cancel`
5. `pause` (sqlite; YAML → erro)
6. `resume` (sqlite; YAML → erro)
7. `snooze` (sqlite; adia próximo disparo sem mutar cron)
8. `reschedule` (sqlite; YAML → erro para editar `routines.yaml`)
9. `preview` (dry-run sem efeitos colaterais: testa resolução de destinatário, cálculo de `next_run_at` e interpolação de variáveis)

Sem `PATCH`, sem `delete` genérico, sem CRUD de contato/template no MCP. `list_agenda` não devolve `content` completo. Config Cursor (`.cursor/mcp.json`) **não** versionada. Mutação em produção via MCP exige consentimento humano nas regras do `AGENTS.md`.

## 3. Alternativas Consideradas

- **Expor o OpenAPI inteiro como MCP:** o modelo quebra schema e dispara jobs YAML.
- **SQLite via MCP de banco:** fura camadas e migrations.

## 4. Consequências e Trade-offs

### Positivas

- Token barato; skill `agenda-job` cabe em uma página.
- HTTP permanece testável com pytest sem MCP.

### Negativas / Riscos Assumidos

- Catálogo de contatos/modelos (ciclo `[00.x]`) **não** vira tool MCP genérica; no máximo parâmetros em `schedule`.
- MCP inútil se a API não estiver no ar; falha com mensagem clara (URL, nunca a chave).

## 5. Referências e Links

- `.agent/skills/mcp-tool/SKILL.md`
- `.agent/CHANNELS.md`
