# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

- **ID:** `[00.4]`
- **Título:** Contrato de UI (`.agent/INTERFACE.md`, locale `pt-BR`)
- **Status:** `PRONTO PARA PLANEJAMENTO`
- **Contexto:** Contatos, ficha `?phone=` e catálogo `/templates` existem. UI no mesmo container só depois deste contrato aprovado.

---

## Log de Tarefas Concluídas

Ciclos `v0.1.0` e `v0.2.0` arquivados em `ARCHIVE.md`.

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [00.3] | Catálogo de templates SQLite + `{{name}}` no disparo | | 2026-09-12 |
| [00.2] | `created_by` no job + `GET /jobs?phone=` | [`8d3485c`] | 2026-09-12 |
| [00.1] | Contatos no SQLite + HTTP (nome, telefone, resolução de `to`) | [`0336dce`] | 2026-09-12 |

---

## Backlog (Próximas, em ordem)

- [ ] Expressões de intervalo amigáveis no MCP (`when`)

---

## Backlog Futuro / Ideias (não priorizadas)

- [ ] **[99.1]** Preparar Release (Tag Git) e Sanitizar Contexto (Apenas executar com permissão explícita do usuário)
- [ ] UI no mesmo container (proto/port **depois** de `[00.4]` aprovado)

---

## Como manter este arquivo enxuto

1. Detalhe só na tarefa ativa. Concluída → uma linha no log e promover o backlog.
2. Backlog é lista de títulos. Spec completa só quando o item vira tarefa ativa.
3. Numeração, arquivo pós-release e âncora `[99.1]`: ver `AGENTS.md`.
