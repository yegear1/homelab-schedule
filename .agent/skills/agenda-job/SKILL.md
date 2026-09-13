---
name: agenda-job
description: Anotar, listar ou cancelar um item da agenda respeitando aliases, fuso America/Sao_Paulo e confirmação ao humano.
---

# Anotação na agenda (`agenda-job`)

## 1. Contexto e Objetivo

O caderno é estruturado; a caneta humana é linguagem natural. Esta skill impede o agente de inventar crontab no SQLite ou `POST /send` direto.

---

## 2. Quando Utilizar

- “Anota”, “me lembra”, “agenda”, “o que tem marcado”, “cancela o lembrete”.
- Implementar `POST /jobs` / loader YAML / tools MCP que criam jobs.

Não usar: disparar `/send` na hora sem job (isso não é agenda). Bug de outro app → skill global `github-bug-issue`.

---

## 3. Ferramentas

- **MCP `homelab-schedule`:** caneta do agente no Cursor — ver skill `anotar-agenda`.
- **HTTP** se o MCP ainda não estiver configurado (mesmos campos, `.agent/ENDPOINTS.md`).
- **Nunca** `WHATSAPP_API_KEY` / `/send` para “anotar”.

---

## 4. Procedimento

### Passo 1: Extrair quatro campos

1. **when** — pontual (data/hora) ou recorrente (cron / “toda segunda 9h”). Fuso `America/Sao_Paulo` se o humano não disser outro.
2. **content** — texto da mensagem (a anotação).
3. **to** — default `eu`; senão alias conhecido. Não pedir id cru se o alias existir.
4. **title** — uma linha; se faltar, derive do content (curto).

Se `when` estiver ambíguo, **uma** pergunta. Não grave.

### Passo 2: Gravar pela caneta certa

- Recado pontual ou cron ad-hoc → MCP `schedule` (ou `POST /jobs`).
- Política permanente → editar `routines.yaml` + id estável, não SQLite.

### Passo 3: Confirmar

Devolva sempre: `id`, próximo disparo local (BRT) e UTC, `to`, `title`/`content`. Sem isso a tarefa de anotação não acabou.

### Passo 4: Listar

`list_agenda` / `GET /jobs?status=upcoming`. Não despeje `content` de todos.

### Passo 5: Cancelar

`cancel` + id. YAML → diga para editar o arquivo. Reagendar = cancel + schedule.

---

## 5. Exemplo

Humano: *“Amanhã 14h me manda pagar condomínio.”*

MCP `schedule`:

```json
{
  "when": "2026-09-12T14:00:00-03:00",
  "to": "eu",
  "title": "condomínio",
  "content": "Pagar condomínio."
}
```

Resposta ao humano: gravado `abc123`, dispara sábado 12/09 14:00 BRT, destino `eu`.

---

## 6. Armadilhas

- ⚠️ Não inventar cron `* * * * *` de teste em produção.
- ⚠️ Não POST `/send` “para ver se funciona” no lugar de um job.
- 💡 `once` após sucesso vira `done`; não reaparece em `upcoming`.

---

## 7. Checklist

- [ ] when/to/content resolvidos
- [ ] caneta certa (sqlite vs yaml)
- [ ] confirmação com next_run
- [ ] sem payload de `/send` no MCP
