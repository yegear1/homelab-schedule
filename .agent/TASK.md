# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

- **ID:** `[03.1]`
- **Título:** Contatos no SQLite + HTTP (nome, telefone, resolução de `to`)
- **Status:** `EM PLANEJAMENTO`
- **Contexto:** Preparar o backend para uma UI simples (contatos, ficha por telefone, depois templates). Sem HTML nesta tarefa. ADR-003 “sem UI” fica em vigor até `[03.4]`; aqui só a API/store que a ficha precisa.

### Plano (aguardando aprovação para `EM EXECUÇÃO`)

1. Tabela `contacts` (`id`, `name`, `phone` único normalizado) no connect; `PRAGMA user_version` +1; skill `database-migration`.
2. Schemas em `src/schemas/` + rotas finas `GET/POST /contacts`, `GET/PATCH /contacts/{id}` (sem DELETE solto se ainda não houver regra; ou DELETE com 409 se o número for destino de job `scheduled` — decidir na execução: v1 permite DELETE).
3. Resolver `to` no create de job: contato por `id` ou `name` **depois** `WHATSAPP_ALIASES` **depois** dígitos crus. Sem quebrar aliases atuais.
4. Testes (create/list/unique phone/normalize) + `ENDPOINTS.md`. MCP **não** ganha CRUD de contato (ADR-005).
5. Fora: `created_by`, templates, UI, INTERFACE.md.

---

## Log de Tarefas Concluídas

Ciclos `v0.1.0` e `v0.2.0` arquivados em `ARCHIVE.md`. Higiene pós-`v0.2.0` (NOTES/ADRs/backlog) em 2026-09-12.

(Vazio — ciclo `03.x` ainda sem item concluído.)

---

## Backlog (Próximas, em ordem)

- [ ] **[03.2]** `created_by` no job + `GET /jobs?phone=` (união destino **ou** criador)
- [ ] **[03.3]** Catálogo de templates SQLite + `{{name}}` e relógio no disparo
- [ ] **[03.4]** Contrato de UI (`.agent/INTERFACE.md`, locale `pt-BR`) — só depois da API existir
- [ ] Expressões de intervalo amigáveis no MCP (`when`)

---

## Backlog Futuro / Ideias (não priorizadas)

- [ ] **[99.1]** Preparar Release (Tag Git) e Sanitizar Contexto (Apenas executar com permissão explícita do usuário)
- [ ] UI no mesmo container (proto/port **depois** de `[03.4]` aprovado)

---

## Como manter este arquivo enxuto

1. Detalhe só na tarefa ativa. Concluída → uma linha no log e promover o backlog.
2. Backlog é lista de títulos. Spec completa só quando o item vira tarefa ativa.
3. Numeração, arquivo pós-release e âncora `[99.1]`: ver `AGENTS.md`.
