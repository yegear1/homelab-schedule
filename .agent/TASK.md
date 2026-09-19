# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

- **ID:** `[02.2]`
- **Título:** Tool de Preview / Dry-Run de Agendamento (renderização de variáveis e cálculo de next_run_at)
- **Status:** `PRONTO PARA PLANEJAMENTO`
- **Contexto:** Permitir testar e visualizar previamente a resolução de destinatário, cálculo de next_run_at e prévia de mensagem antes da persistência.

---

## Log de Tarefas Concluídas

Ciclos `v0.1.0`, `v0.2.0` e `v0.3.0` arquivados em `ARCHIVE.md`.

- [02.1] Filtros Avançados e Busca na Caneta MCP (contato, texto, período relativo)

---

## Backlog (Próximas, em ordem)

- [ ] Saudações e Variáveis Dinâmicas Seguras em Templates ({{greeting}}, {{time}}, {{date}})
- [ ] Dead-Letter e Ação Rápida de Re-enfileiramento (Retry Manual na UI e API)
- [ ] Histórico de Execuções (job_runs / auditoria de disparos)
- [ ] Visão em Calendário / Linha do Tempo na UI
- [ ] Importação / Exportação e Backup do SQLite
- [ ] Contas: OTP + senha + sessão (adiado)

---

## Backlog Futuro / Ideias (não priorizadas)

- [ ] **[99.1]** Preparar Release (Tag Git) e Sanitizar Contexto (Apenas executar com permissão explícita do usuário)

---

## Como manter este arquivo enxuto

1. Detalhe só na tarefa ativa. Concluída → uma linha no log e promover o backlog.
2. Backlog é lista de títulos. Spec completa só quando o item vira tarefa ativa.
3. Numeração, arquivo pós-release e âncora `[99.1]`: ver `AGENTS.md`.
