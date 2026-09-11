# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

- **ID:** Nenhuma
- **Título:** Nenhuma
- **Status:** `CONCLUÍDO`
- **Contexto:** Todas as tarefas da iteração concluídas. Aguardando próximas diretrizes do usuário.

---

## Log de Tarefas Concluídas

Ciclo `v0.1.0` arquivado em `ARCHIVE.md`.

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|
| [01.4] | Housekeeping e expurgo automático de jobs antigos no SQLite | [`2de02f1`] | 2026-09-11 |
| [01.3] | Watch / Reload de `routines.yaml` em runtime via `/routines/reload` e mtime | [`223ac9b`] | 2026-09-11 |
| [01.2] | Suporte a `reschedule` / `snooze` de recados pontuais no MCP e HTTP | [`ddb85e1`] | 2026-09-11 |
| [01.1] | Persistir `target_number` normalizado no job e documentar gateway agnóstico | [`33fe49b`] | 2026-09-11 |

---

## Backlog (Próximas, em ordem)

(Vazio no momento - aguardando novas definições de produto ou promoção de ideias)

---

## Backlog Futuro / Ideias (não priorizadas)

- [ ] **[99.1]** Preparar Release (Tag Git) e Sanitizar Contexto (Apenas executar com permissão explícita do usuário)
- [ ] Comando WhatsApp `!lembra` / `!agenda` no repo `whatsapp-api` (contrato: `.agent/CHANNELS.md`)
- [ ] Expressões de intervalo amigáveis e templates dinâmicos de mensagem


---

## Como manter este arquivo enxuto

1. Detalhe só na tarefa ativa. Concluída → uma linha no log e promover o backlog.
2. Backlog é lista de títulos. Spec completa só quando o item vira tarefa ativa.
3. Numeração, arquivo pós-release e âncora `[99.1]`: ver `AGENTS.md`.
