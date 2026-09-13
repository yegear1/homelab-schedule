# INTERFACE.md — Contrato de superfície de UI

> Fonte da verdade para um agente de implementação. Sem tela/ação aqui, não há UI.
> Preenchido pela skill `ui-contract`. Stack fica em ADR do repo de frontend, não neste arquivo.
> Chrome (seção 8) é obrigatório mesmo sem rota de preferências.
> Duas cópias (backend e frontend) devem ser o **mesmo** arquivo após cada aprovação. API mudou → `Desatualizado` até o Passo 6 da skill.

**Status do contrato:** `Aprovado` (2026-09-12 — mapa das quatro telas; contas/OTP ficam de fora desta versão)  
**Backend:** `yegear1/homelab-schedule`  
**Base URL (dev):** `http://localhost:8003` (`APP_PORT` / env)  
**Última derivação:** `2026-09-12` · fontes: `src/homelab_schedule/*_router.py`, `src/schemas/`, `.agent/ENDPOINTS.md`, `README.md`

---

## 1. Contexto

- **Atores:** operador do homelab (uma pessoa). Contatos **não** autenticam na UI.
- **Auth:** header — nome exato: `x-api-key` = `SCHEDULE_API_KEY`. Sem `Authorization: Bearer`. Só `GET /health` dispensa chave.
- **Restrições globais do domínio:** um processo / um SQLite; disparo é o tick no servidor (a UI não chama `POST /send`). `202` em `run` = gateway **enfileirou**, não entrega. Jobs `source: yaml` não se cancelam/reagendam pela HTTP (editar `routines.yaml`). Query `to` em `GET /jobs` é **fim de intervalo de data**, não destino; pessoa = `phone`.

---

## 2. Mapa de telas

| ID | Rota de UI | Propósito | Tela pai / nav |
| :--- | :--- | :--- | :--- |
| `scr-contacts` | `/contacts` | Caderno de pessoas (nome + telefone) | Home / nav |
| `scr-contact` | `/contacts/{contactId}` | Ficha: editar contato + agendas **para** ou **criadas por** o telefone | `scr-contacts` |
| `scr-templates` | `/templates` | Catálogo de textos com placeholders | Nav |
| `scr-jobs` | `/jobs` | Agenda global (listagem curta + criar / detalhe) | Nav |

---

## 3. Ficha de tela (copie por ID)

### Tela `scr-contacts` — Contatos

- **Rota de UI:** `/contacts`
- **Propósito:** listar e cadastrar pessoas (nome + número). Clique no item abre a ficha.
- **Widgets / regiões:**

| Região | Binding | Campos visíveis | Obrigatório na UI? |
| :--- | :--- | :---: | :---: |
| `wdg-contact-list` | `GET /contacts` → `{ contacts: Contact[] }` | `id`, `name`, `phone` | — (leitura) |
| `wdg-contact-create` | (form local) | `name`, `phone` | `name` sim; `phone` sim |

- **Ações:**

| Ação | Binding | Pré-condição | Sucesso | Erros → copy |
| :--- | :--- | :--- | :--- | :--- |
| Criar contato | `POST /contacts` body `{ name, phone }` | `name` 1–80; `phone` 1–64 | `201` Contact; atualizar lista | `401` → chave inválida ou ausente; `422` → dados inválidos; `409` → nome ou telefone já existe |
| Abrir ficha | navegação UI | item da lista | `scr-contact` | — |

- **Estados:**
  - `loading`: lista ainda não chegou
  - `empty`: `contacts` vazio — cadastre o primeiro contato
  - `error` (rede / 5xx): falha ao carregar; `401` tratado como auth, não como 5xx
  - `domínio`: nenhum além de lista vazia
- **Não mostrar:** path de SQLite; valor de `SCHEDULE_API_KEY`

---

### Tela `scr-contact` — Ficha da pessoa

- **Rota de UI:** `/contacts/{contactId}`
- **Propósito:** ver/editar o contato e a união de jobs cujo destino **ou** criador é o telefone da pessoa.
- **Widgets / regiões:**

| Região | Binding | Campos visíveis | Obrigatório na UI? |
| :--- | :--- | :---: | :---: |
| `wdg-contact-header` | `GET /contacts/{id}` | `id`, `name`, `phone` | — |
| `wdg-contact-edit` | (form) | `name`, `phone` (schema PATCH: ambos opcionais) | não (enviar só o que mudou) |
| `wdg-job-list` | `GET /jobs?status=all&phone={phone}` | `JobListItem`: `id`, `title`, `to`, `target_number`, `kind`, `run_at`, `cron_expr`, `enabled`, `source`, `status`, `next_run_at`, `last_run_at`, `last_status`, `created_by`, `template_id` — **sem** `content` | `phone` no query (valor do contato, não digitado se já na ficha) |
| `wdg-job-detail` | `GET /jobs/{id}` | Job completo: inclui `content`, `last_error`, `retry_count` | após seleção |
| `wdg-job-create` | (form) | `title`; `kind`; `run_at` se `once`; `cron_expr` se `cron`; `content` **ou** `template_id` (não os dois); `to` pré-preenchido com o contato; `created_by` pré-preenchido com `phone` (opcional no schema) | `title` sim; `kind` sim; `run_at` se once; `cron_expr` se cron; `content` xor `template_id` |
| `wdg-template-pick` | `GET /templates` | `id`, `name` (picker) | não |

Query `from` / `to` / `limit` de `GET /jobs` são opcionais (`limit` 1–100 se usado). Filtro de pessoa **só** `phone`. Default de `status` na API é `upcoming`; nesta ficha o contrato pede `status=all` para “todas as agendas”.

- **Ações:**

| Ação | Binding | Pré-condição | Sucesso | Erros → copy |
| :--- | :--- | :--- | :--- | :--- |
| Salvar contato | `PATCH /contacts/{id}` `{ name?, phone? }` | contato carregado | `200` Contact; se `phone` mudou, recarregar jobs com o novo número | `401`; `404` → contato não encontrado; `409` → nome ou telefone já existe; `422` |
| Excluir contato | `DELETE /contacts/{id}` | contato carregado | `204` → voltar a `scr-contacts` | `401`; `404`; `409` → há job `scheduled` para este telefone |
| Agendar | `POST /jobs` | ver form | `201` Job; atualizar `wdg-job-list` | `401`; `404` → template inexistente; `422` → content/template_id/kind/run_at/cron |
| Ver detalhe | `GET /jobs/{id}` | job na lista | preencher `wdg-job-detail` | `401`; `404` → recado não encontrado |
| Cancelar recado | `POST /jobs/{id}/cancel` | `source=sqlite` | `204`; atualizar lista | `401`; `404`; `409` → edite `routines.yaml` (job YAML) |
| Reagendar | `POST /jobs/{id}/reschedule` `{ run_at }` **ou** `{ cron_expr }` | `source=sqlite`; um dos dois campos | `200` Job | `401`; `404`; `409` YAML; `422` se nenhum campo ou cron ≠ 5 campos |
| Disparar agora | `POST /jobs/{id}/run` | ação explícita (nunca home) | `202` `{ status: queued, job_id }` — enfileirado no gateway, não é entrega | `401`; `404`; `502` → gateway não aceitou |

Na lista, distinguir visualmente destino (`target_number` = telefone da ficha) vs criador (`created_by` = telefone da ficha). Job YAML: cancelar/reagendar indisponíveis (a API responde `409`).

- **Estados:**
  - `loading`: header e/ou lista de jobs
  - `empty`: jobs `[]` — nenhuma agenda para este telefone
  - `error` (rede / 5xx)
  - `domínio`: `status` do job `scheduled` \| `done` \| `paused` \| `error`; `source` `yaml` vs `sqlite`
- **Não mostrar:** stack em `last_error` (a API já não envia); `target_number` cru como único rótulo se houver `name` do contato; payload de `/send`

---

### Tela `scr-templates` — Modelos

- **Rota de UI:** `/templates`
- **Propósito:** CRUD de textos reutilizáveis. Placeholders no disparo (não na UI): relógio `{{date}}`, `{{date_iso}}`, `{{time}}`, `{{weekday}}`, `{{day_name}}`, `{{month_name}}`, `{{year}}`; `{{name}}` = nome do contato **destino**. Tag desconhecida permanece literal.
- **Widgets / regiões:**

| Região | Binding | Campos visíveis | Obrigatório na UI? |
| :--- | :--- | :---: | :---: |
| `wdg-template-list` | `GET /templates` → `{ templates }` | `id`, `name`, `body` | — |
| `wdg-template-form` | `GET /templates/{id}` ao editar | `name`, `body` | criar: `name` sim, `body` sim; PATCH: ambos opcionais |

- **Ações:**

| Ação | Binding | Pré-condição | Sucesso | Erros → copy |
| :--- | :--- | :--- | :--- | :--- |
| Criar | `POST /templates` `{ name, body }` | `name` 1–80; `body` min 1 | `201`; atualizar lista | `401`; `422`; `409` → nome já existe |
| Salvar | `PATCH /templates/{id}` `{ name?, body? }` | item selecionado | `200` | `401`; `404`; `409`; `422` |
| Excluir | `DELETE /templates/{id}` | item selecionado | `204` | `401`; `404`; `409` → há job `scheduled` com este `template_id` |

- **Estados:**
  - `loading`
  - `empty`: nenhum modelo
  - `error` (rede / 5xx)
  - `domínio`: nenhum extra
- **Não mostrar:** Jinja / linguagens de template que a API não tem

---

### Tela `scr-jobs` — Agenda

- **Rota de UI:** `/jobs`
- **Propósito:** ver recados sem filtrar por pessoa; criar recado avulso; detalhe + cancelar / reagendar / disparar agora.
- **Widgets / regiões:**

| Região | Binding | Campos visíveis | Obrigatório na UI? |
| :--- | :--- | :---: | :---: |
| `wdg-job-filters` | query de `GET /jobs` | `status` default `upcoming` (`upcoming` \| `done` \| `paused` \| `error` \| `all`); `from` / `to` opcionais (intervalo de **tempo**); `phone` opcional; `limit` opcional 1–100 | `status` não (API tem default) |
| `wdg-job-list` | `GET /jobs` | `JobListItem` (sem `content`) | — |
| `wdg-job-detail` | `GET /jobs/{id}` | Job completo | após seleção |
| `wdg-job-create` | (form) | iguais ao create da ficha; `to` default API `"eu"`; `created_by` opcional; picker `GET /contacts` e `GET /templates` | `title`, `kind`; `content` xor `template_id`; `run_at` se once; `cron_expr` se cron |
| `wdg-contact-pick` | `GET /contacts` | `id`, `name`, `phone` para `to` / `created_by` | não |

- **Ações:** mesmas de job que em `scr-contact` (`POST /jobs`, `GET /jobs/{id}`, cancel, reschedule, run) com os mesmos erros. Filtro `phone` nesta tela é opcional (não substitui a ficha).

- **Estados:**
  - `loading`
  - `empty`: nenhum job no filtro atual
  - `error` (rede / 5xx)
  - `domínio`: `scheduled` \| `done` \| `paused` \| `error`; YAML imutável
- **Não mostrar:** `content` na lista; interpretar query `to` como destinatário

---

## 4. NFRs (só com evidência)

| ID | Requisito | Evidência (arquivo, status HTTP, doc) |
| :--- | :--- | :--- |
| `nfr-auth` | Toda rota de produto exige `x-api-key` = `SCHEDULE_API_KEY`; mismatch → `401` `{ detail }` | `auth.py`, `ENDPOINTS.md` |
| `nfr-quota` | — | Sem `429` / `Retry-After` neste serviço |
| `nfr-offline` | Falha de rede / 5xx genérico; sem estado de domínio “equipamento off” | README: tick e gateway no servidor |
| `nfr-poll` | — | Sem SSE/poll documentado; refresh é ação do usuário (disparo é o tick) |
| `nfr-run` | `POST /jobs/{id}/run` → `202` queued ou `502` se o gateway não aceitar | `jobs_router.py`, `ENDPOINTS.md`, ADR-004 |

A UI guarda a chave só no cliente (não há rota de sessão). Sem tela `/login` na API.

---

## 5. Inventário de rotas

Toda rota do backend aparece **uma** vez.

| Método | Path | Classe | Destino (ID tela / ação / —) |
| :---: | :--- | :--- | :--- |
| `GET` | `/health` | `ops-only` | — |
| `GET` | `/jobs` | `screen` | `scr-jobs` (`wdg-job-list`); também `widget` em `scr-contact` com `phone` |
| `POST` | `/jobs` | `action` | `scr-jobs` / `scr-contact` criar |
| `GET` | `/jobs/{id}` | `widget` | `wdg-job-detail` em `scr-jobs` e `scr-contact` |
| `POST` | `/jobs/{id}/cancel` | `action` | `scr-jobs` / `scr-contact` |
| `POST` | `/jobs/{id}/reschedule` | `action` | `scr-jobs` / `scr-contact` |
| `POST` | `/jobs/{id}/run` | `action` | `scr-jobs` / `scr-contact` (explícita) |
| `GET` | `/contacts` | `screen` | `scr-contacts`; picker em `scr-jobs` |
| `POST` | `/contacts` | `action` | `scr-contacts` |
| `GET` | `/contacts/{id}` | `widget` | `wdg-contact-header` em `scr-contact` |
| `PATCH` | `/contacts/{id}` | `action` | `scr-contact` |
| `DELETE` | `/contacts/{id}` | `action` | `scr-contact` |
| `GET` | `/templates` | `screen` | `scr-templates`; picker em create de job |
| `POST` | `/templates` | `action` | `scr-templates` |
| `GET` | `/templates/{id}` | `widget` | `wdg-template-form` |
| `PATCH` | `/templates/{id}` | `action` | `scr-templates` |
| `DELETE` | `/templates/{id}` | `action` | `scr-templates` |
| `POST` | `/routines/reload` | `deferred` | §7 |
| `POST` | `/housekeeping/purge` | `deferred` | §7 |

---

## 6. Fora de escopo

- `GET /health` (probe; Vector pode descartar no HDD)
- Cliente de mensageiro, bot, `POST /send` direto (gateway fora deste host de produto)
- Tools MCP (`schedule`, `list_agenda`, …) — caneta de agente, não tela
- Edição de `routines.yaml` no browser
- Tela `/settings` só para tema/idioma
- Cadastro / login / reset por telefone+OTP+senha; papéis admin vs conta (revisitar depois de validar esta UI)

## 7. Adiado

- `POST /routines/reload` — operador Git/YAML; sem fluxo na UI simples
- `POST /housekeeping/purge` — manutenção (`JOB_RETENTION_DAYS`); o tick já expurga; sem tela nesta versão
- Expressões amigáveis de `when` (backlog MCP, não HTTP)
- Contas de pessoa: OTP 5 min via gateway, senha, sessão no browser, allowlist de operador. Auth desta versão = só `x-api-key` de operador.

---

## 8. Chrome (não deriva de rota)

Preferências de superfície. **Não** é tela de produto: não criar `scr-settings` nem rota `/settings` só por isto. Tema: especifique comportamento, não o widget. Locale `selectable`: o seletor **leva bandeira por território** (ver abaixo).

Não há perfil de usuário com tema/locale no schema.

### Tema (obrigatório)

| Campo | Valor |
| :--- | :--- |
| Valores | `light` \| `system` \| `dark` (três modos; nunca só claro/escuro) |
| Default | `system` (`prefers-color-scheme` + override) |
| Persistência | `local` (cliente) — sem binding HTTP |
| Onde | chrome global (header, overflow, rodapé) |

### Locale (obrigatório — acordar no Passo 5)

| Campo | Valor |
| :--- | :--- |
| Política | `fixed` |
| Acordo humano | `sim` — `pt-BR` combinado no ciclo `[00.x]` / tarefa `[00.4]` (não reabrir salvo pedido) |
| Locales | `pt-BR` |
| Fallback | `pt-BR` |
| Persistência | `local` — sem binding |
| `Accept-Language` nas requests | `não` (handlers não leem o header) |

Sem seletor de idioma. Copy das fichas neste arquivo está em português (idioma de trabalho). A UI implementada usa só `pt-BR`.

---

## 9. Âncoras de implementação (stack-agnóstico)

O proto HTML e o porte (Svelte ou outro) **reutilizam** estes identificadores. Sem âncora aqui, o implementador não inventa `id`.

**Documento:** `<html data-theme="system">` (valores: `light` \| `system` \| `dark`). Locale `fixed`: sem seletor de bandeira.

**Por região:**

| Tela | Região / widget | `id` DOM | `name` dos campos (schema) | `data-state` usados |
| :--- | :--- | :--- | :--- | :--- |
| `scr-contacts` | página | `scr-contacts` | — | `loading` \| `empty` \| `error` |
| `scr-contacts` | `wdg-contact-list` | `wdg-contact-list` | — | `loading` \| `empty` \| `error` |
| `scr-contacts` | `wdg-contact-create` | `wdg-contact-create` | `name`, `phone` | `error` |
| `scr-contact` | página | `scr-contact` | — | `loading` \| `empty` \| `error` |
| `scr-contact` | `wdg-contact-header` | `wdg-contact-header` | — | `loading` \| `error` |
| `scr-contact` | `wdg-contact-edit` | `wdg-contact-edit` | `name`, `phone` | `error` |
| `scr-contact` | `wdg-job-list` | `wdg-job-list` | `status`, `phone` (query) | `loading` \| `empty` \| `error` |
| `scr-contact` | `wdg-job-detail` | `wdg-job-detail` | — | `loading` \| `empty` \| `error` |
| `scr-contact` | `wdg-job-create` | `wdg-job-create` | `title`, `content`, `to`, `kind`, `run_at`, `cron_expr`, `created_by`, `template_id` | `error` |
| `scr-contact` | `wdg-template-pick` | `wdg-template-pick` | `template_id` | `loading` \| `empty` \| `error` |
| `scr-templates` | página | `scr-templates` | — | `loading` \| `empty` \| `error` |
| `scr-templates` | `wdg-template-list` | `wdg-template-list` | — | `loading` \| `empty` \| `error` |
| `scr-templates` | `wdg-template-form` | `wdg-template-form` | `name`, `body` | `error` |
| `scr-jobs` | página | `scr-jobs` | — | `loading` \| `empty` \| `error` |
| `scr-jobs` | `wdg-job-filters` | `wdg-job-filters` | `status`, `from`, `to`, `phone`, `limit` | — |
| `scr-jobs` | `wdg-job-list` | `wdg-job-list` | — | `loading` \| `empty` \| `error` |
| `scr-jobs` | `wdg-job-detail` | `wdg-job-detail` | — | `loading` \| `empty` \| `error` |
| `scr-jobs` | `wdg-job-create` | `wdg-job-create` | `title`, `content`, `to`, `kind`, `run_at`, `cron_expr`, `created_by`, `template_id` | `error` |
| `scr-jobs` | `wdg-contact-pick` | `wdg-contact-pick` | `to`, `created_by` | `loading` \| `empty` \| `error` |
