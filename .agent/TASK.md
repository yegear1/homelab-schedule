# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

- **ID:** `[02.11]`
- **Título:** Ciclo de Vida Avançado para Recorrentes (`until`, `max_runs` e Pausa Temporária/Snooze)
- **Status:** `PRONTO PARA PLANEJAMENTO`
- **Contexto:** Suporte a condições de encerramento automático para jobs recorrentes (`until` em timestamp UTC e `max_runs` em contador de ocorrências) e capacidade de pausa temporária/adiamento (snooze) sem cancelamento definitivo.

---

## Log de Tarefas Concluídas

Ciclos `v0.1.0`, `v0.2.0` e `v0.3.0` arquivados em `ARCHIVE.md`.

- [02.10] Alertas de Dead-Letter para o Operador (Notificação de Falha Crítica no Gateway)
- [02.9] Variáveis Customizadas em Jobs e Templates (`variables` em Jobs e Interpolação Segura)
- [02.7] Importação / Exportação e Backup do SQLite
- [02.6] Visão em Calendário / Linha do Tempo na UI
- [02.5] Histórico de Execuções (job_runs / auditoria de disparos)
- [02.4] Dead-Letter e Ação Rápida de Re-enfileiramento (Retry Manual na UI e API)
- [02.3] Saudações e Variáveis Dinâmicas Seguras em Templates ({{greeting}}, {{time}}, {{date}})
- [02.2] Tool de Preview / Dry-Run de Agendamento (renderização de variáveis e cálculo de next_run_at)
- [02.1] Filtros Avançados e Busca na Caneta MCP (contato, texto, período relativo)

---

## Backlog (Próximas, em ordem)

- [ ] **[02.12]** Síntese Matinal e Prevenção de Conflitos no MCP (`daily_digest` e aviso preventivo)

---

## Backlog Futuro / Ideias (não priorizadas)

- [ ] **[02.8]** Contas: OTP + Senha + Sessão na UI (Adiado para avaliação futura de necessidade)
- [ ] **[99.1]** Preparar Release (Tag Git) e Sanitizar Contexto (Apenas executar com permissão explícita do usuário)

---

## Como manter este arquivo enxuto

1. Detalhe só na tarefa ativa. Concluída → uma linha no log e promover o backlog.
2. Backlog é lista de títulos. Spec completa só quando o item vira tarefa ativa.
3. Numeração, arquivo pós-release e âncora `[99.1]`: ver `AGENTS.md`.
