# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

- **ID:** `[00.5]`
- **Título:** Protótipo HTML das quatro telas (`ui-prototype`)
- **Status:** `PRONTO PARA PLANEJAMENTO`
- **Contexto:** `.agent/INTERFACE.md` aprovado (operador + `x-api-key`, locale `pt-BR`). Sem contas/OTP. Só proto estático depois de pedido explícito; porte no mesmo container depois do proto aprovado.

---

## Log de Tarefas Concluídas

Ciclos `v0.1.0` e `v0.2.0` arquivados em `ARCHIVE.md`.

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [00.4] | Contrato de UI (INTERFACE.md, `pt-BR`) | | 2026-09-12 |
| [00.3] | Catálogo de templates SQLite + `{{name}}` no disparo | [`ba09917`] | 2026-09-12 |
| [00.2] | `created_by` no job + `GET /jobs?phone=` | [`8d3485c`] | 2026-09-12 |
| [00.1] | Contatos no SQLite + HTTP (nome, telefone, resolução de `to`) | [`0336dce`] | 2026-09-12 |

---

## Backlog (Próximas, em ordem)

- [ ] UI no mesmo container (`ui-port`, depois do proto aprovado)
- [ ] Expressões de intervalo amigáveis no MCP (`when`)
- [ ] Contas: OTP + senha + sessão (adiado)

---

## Backlog Futuro / Ideias (não priorizadas)

- [ ] **[99.1]** Preparar Release (Tag Git) e Sanitizar Contexto (Apenas executar com permissão explícita do usuário)

---

## Como manter este arquivo enxuto

1. Detalhe só na tarefa ativa. Concluída → uma linha no log e promover o backlog.
2. Backlog é lista de títulos. Spec completa só quando o item vira tarefa ativa.
3. Numeração, arquivo pós-release e âncora `[99.1]`: ver `AGENTS.md`.
