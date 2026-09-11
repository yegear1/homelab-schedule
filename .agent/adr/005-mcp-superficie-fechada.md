# [ADR-005] MCP com superfície fechada (quatro tools)

- **Status:** Aprovado
- **Data:** 2026-09-11
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

Agentes alucinam crontab e PATCH genérico. O MCP do VictoriaLogs funciona porque tem poucas tools e respostas curtas. A agenda precisa do mesmo: listar o marcado e gravar recado sem CRUD REST no protocolo MCP.

## 2. Decisão Tomada

Servidor MCP **stdio**, Python, zero UI, chamando a HTTP local (não abre SQLite direto). Tools:

1. `schedule`
2. `list_agenda`
3. `get_item`
4. `cancel`

Sem `PATCH`, sem `delete` genérico, sem passar `phone_number` cru se houver alias. `list_agenda` não devolve `content` completo. Config Cursor (`.cursor/mcp.json`) **não** versionada. Mutação em produção via MCP exige consentimento humano nas regras do `AGENTS.md`.

## 3. Alternativas Consideradas

- **Expor o OpenAPI inteiro como MCP:** o modelo quebra schema e dispara jobs YAML.
- **SQLite via MCP de banco:** fura camadas e migrations.

## 4. Consequências e Trade-offs

### Positivas

- Token barato; skill `agenda-job` cabe em uma página.
- HTTP permanece testável com pytest sem MCP.

### Negativas / Riscos Assumidos

- Reagendar em dois passos (cancel + schedule) pode falhar no meio — `reschedule` no backlog futuro.
- MCP inútil se a API não estiver no ar; o servidor deve falhar com mensagem clara (URL/chave).

## 5. Referências e Links

- `infra-victoria-logs/mcp/server.py` (padrão stdio leve)
- `.agent/skills/mcp-tool/SKILL.md`
