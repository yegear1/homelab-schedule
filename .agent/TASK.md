# TASK.md — Tarefa Atual e Roadmap do Projeto

> O QUE fazer agora. Histórico detalhado vive no `git log`. Pedido do usuário na
> conversa vence este arquivo — reporte a divergência antes de agir.

---

## Tarefa Ativa

Nenhuma. Ciclo `v0.1.0` publicado. Próxima tarefa pronta para planejamento no backlog.

---

## Log de Tarefas Concluídas

Ciclo `v0.1.0` arquivado em `ARCHIVE.md`.

| Tarefa | Título | Commit(s) | Data |
|---|---|---|---|

---

## Backlog (Próximas, em ordem)

- [ ] **[01.1]** Suporte a `reschedule` / `snooze` de recados pontuais no MCP e HTTP (PRONTO PARA PLANEJAMENTO)
- [ ] **[01.2]** Watch / Reload de `routines.yaml` em runtime via endpoint `POST /routines/reload` ou mtime

---

## Backlog Futuro / Ideias (não priorizadas)

- [ ] **[99.1]** Preparar Release (Tag Git) e Sanitizar Contexto (Apenas executar com permissão explícita do usuário)
- [ ] Comando WhatsApp `!lembra` / `!agenda` no repo `whatsapp-api` (contrato: `.agent/CHANNELS.md`)
- [ ] Housekeeping e limpeza periódica de jobs finalizados no SQLite
- [ ] Expressões de intervalo amigáveis e templates dinâmicos de mensagem


---

## Como manter este arquivo enxuto

1. Detalhe só na tarefa ativa. Concluída → uma linha no log e promover o backlog.
2. Backlog é lista de títulos. Spec completa só quando o item vira tarefa ativa.
3. Numeração, arquivo pós-release e âncora `[99.1]`: ver `AGENTS.md`.
