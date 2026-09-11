# NOTES.md — Decisões, Contexto e Contratos do Projeto

> O PORQUÊ. O QUE fica no `git log` / `TASK.md`. Só escreva aqui se explicar uma
> decisão; changelog não entra.

---

## Como usar

1. Leia antes de planejar. Decisões aqui vencem a “forma óbvia”, salvo o usuário pedir para revisitar.
2. Registre: trade-off, contrato, armadilha, skill nova, débito consciente.
3. Entrada longa → ADR em `.agent/adr/` e aqui uma linha + link.

---

## ADRs formais

| ADR | Título | Status | Data |
|---|---|---|---|
| | *(ainda nenhum)* | | |

---

## Decisões rápidas

### [AAAA-MM-DD] [Título]

- **Contexto:** […]
- **Decisão:** […]
- **Alternativas consideradas:** […]
- **Consequências:** […]

---

## Contratos vigentes

Schema completo vive no código (`[core/schemas/]`). Aqui só o mapa:

| Canal / Rota | Produtor | Consumidor | Payload |
|---|---|---|---|
| | | | |

Alteração de contrato = atualizar schemas dos lados na mesma tarefa.

---

## Armadilhas

- **[Lib/serviço]:** [comportamento inesperado e mitigação]

---

## Débitos assumidos

| Débito | Motivo | Quando revisitar |
|---|---|---|
| | | |
