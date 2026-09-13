# [ADR-007] UI operador no mesmo repo (`web/` + `proto/`)

- **Status:** Aprovado
- **Data:** 2026-09-12
- **Autor(es):** yegear / chat de desenho

---

## 1. Contexto do Problema

A API de contatos, templates e `GET /jobs?phone=` existe. O contrato [INTERFACE.md](../INTERFACE.md) está aprovado. O visual canônico é Stitch em `proto/scr-*/code.html`. Precisa de um lugar no git para o app, sem misturar com `src/homelab_schedule/` e sem segundo container nesta fase.

## 2. Decisão Tomada

- **`proto/`** — fonte visual (layout A Stitch). Não é o que o Compose serve em produção. Não apagar no porte.
- **`web/`** — app Svelte 5 + Vite (SPA). Extração: `web/src/layout/`, `web/src/components/`, `web/src/pages/` (`scr-*`). Cliente HTTP em `web/src/lib/` só no porte.
- **Stack:** Svelte 5, Tailwind (classes do Stitch). Sem React/Vue neste repo.
- **Runtime:** mesmo processo FastAPI (StaticFiles do `web/dist/` no porte). `x-api-key` de operador. Sem contas/OTP nesta versão.
- Canetas MCP / HTTP / YAML **permanecem**. A UI é a quarta superfície, não um bot.

Isto **reabre** o “sem UI neste repo” do [ADR-003](003-canetas.md) só para o operador web. CalDAV, e-mail, Telegram e cliente de mensageiro continuam fora.

## 3. Alternativas Consideradas

- **Repo frontend separado:** duas cópias de `INTERFACE.md`; o homelab quer um container.
- **HTML estático servido de `proto/`:** não liga bindings; Stitch usa CDN Tailwind.
- **Svelte dentro de `src/homelab_schedule/`:** mistura hatch/Python e o bundler.

## 4. Consequências e Trade-offs

### Positivas

- Porte segue `ui-port` com árvore previsível.
- `proto/` fica como referência lado a lado do app.

### Negativas / Riscos Assumidos

- Imagem Docker passa a ter stage Node no porte (ainda não neste ADR de pastas).
- `node_modules` / `web/dist` não entram no git.

## 5. Referências e Links

- `.agent/INTERFACE.md`
- `proto/scr-contacts|scr-contact|scr-templates|scr-jobs/code.html`
