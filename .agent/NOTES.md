# NOTES.md — Decisões, Contexto e Contratos do Projeto

> O PORQUÊ. O QUE fica no `git log` / `TASK.md`. Só escreva aqui se explicar uma
> decisão; changelog não entra. Dumps de tarefa já em ADR/`git log` não se repetem.

---

## Visão

```text
caneta MCP / HTTP / YAML (+ UI no mesmo container, ciclo `[00.x]` pós-v0.2.0)
        → caderno (SQLite + routines.yaml)
            → tick: next_run_at UTC + asyncio.Event
                → POST {WHATSAPP_API_URL}/send  →  202 queued
```

Um processo. Sem Redis, sem APScheduler, sem Alembic, sem cliente de mensageiro neste repo. UI web não entra no v0.2.0; backend para o front é o ciclo `[00.x]` (numeração reiniciada após a tag).

---

## ADRs formais

| ADR | Título | Status | Data |
|---|---|---|---|
| [ADR-001](adr/001-monolito-python-uv.md) | Um processo FastAPI + tick SQLite, UV, Python 3.13 | Aprovado | 2026-09-11 |
| [ADR-002](adr/002-sqlite-e-yaml.md) | SQLite WAL para recados; YAML para rotinas permanentes | Aprovado | 2026-09-11 |
| [ADR-003](adr/003-canetas.md) | Três canetas neste repo; callers HTTP fora da árvore | Aprovado | 2026-09-11 |
| [ADR-004](adr/004-dispatch-gatekeeper.md) | Dispatch só via POST /send; 202 = sucesso | Aprovado | 2026-09-11 |
| [ADR-005](adr/005-mcp-superficie-fechada.md) | MCP superfície fechada (`schedule`, `list_agenda`, `get_item`, `cancel`, `reschedule`) | Aprovado | 2026-09-11 |
| [ADR-006](adr/006-tick-next-run.md) | Avisos no tempo: `next_run_at` + tick asyncio | Aprovado | 2026-09-11 |
| [ADR-007](adr/007-ui-mesmo-repo.md) | UI operador no mesmo repo (`web/` + `proto/`, Svelte 5) | Aprovado | 2026-09-12 |

---

## Decisões que não estão só no ADR

### [2026-09-19] Visão em Calendário e Linha do Tempo na UI (Svelte 5 Runes)

- **Contexto:** Operadores precisavam de acompanhamento temporal intuitivo na interface web para além da visualização tabular estática, permitindo inspecionar a densidade cronológica dos agendamentos futuros (`next_run_at`) e correlacionar visualmente com o histórico de execuções passadas (`job_runs` / `ran_at`).
- **Decisão:**
  - **Alternador Segmentado no Header:** Em `Agendas Registradas` (`#wdg-job-list`), introduzido controle segmentado acessível (`tab-view-table`, `tab-view-timeline`, `tab-view-calendar`) com estado reativo `activeView: 'table' | 'timeline' | 'calendar'`, preservando a tabela clássica como default e permitindo alternância instantânea.
  - **Componente Linha do Tempo (`JobTimelineView.svelte`):** Renderiza fluxo vertical cronológico conectado por marcadores visuais. Divide eventos em seções: "Próximos Agendamentos" (ordenados por vencimento ascendente, com cálculo de tempo relativo pt-BR e identificação de Dead-Letter) e "Histórico de Execuções" (ordenadas por data descendente com latência em ms e status HTTP do despachante). Filtro rápido permite alternar entre "Todos", "Futuros" e "Histórico".
  - **Componente Calendário Mensal (`JobCalendarView.svelte`):** Grade mensal interativa calculada dinamicamente, com navegação de meses (Anterior, Próximo, "Hoje"), destaque visual para a data atual, chips com contagem diária de agendamentos e execuções com badge de erro/alerta, e painel de inspeção de eventos por data selecionada.
  - **Integração Unificada com Drawer de Detalhes:** Ambas as novas visões reutilizam a seleção ativa `selectedJob` e as ações de disparo imediato (`handleRun`), re-enfileiramento (`handleRetry`), cancelamento e reagendamento, mantendo sincronia completa com `#wdg-job-detail`.

### [2026-09-19] Histórico de Execuções (job_runs / auditoria de disparos, SQLite v8)

- **Contexto:** Necessidade de rastreabilidade ponta a ponta de cada tentativa de envio realizada pelo scheduler (loop `due-tick`) ou por disparos manuais (`run_now`), capturando instante exato, gatilho, latência do gateway HTTP, status code e erros ocorridos.
- **Decisão:**
  - **Schema SQLite v8:** Tabela `job_runs` com `id TEXT PRIMARY KEY`, `job_id TEXT NOT NULL`, `ran_at TEXT NOT NULL`, `trigger TEXT NOT NULL` (`schedule` | `manual`), `status TEXT NOT NULL` (`success` | `error`), `status_code INTEGER NOT NULL`, `duration_ms REAL NOT NULL`, `error_message TEXT`, com `FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE` e índices `(job_id, ran_at DESC)` e `(ran_at DESC)`.
  - **Medição de Latência:** `GatekeeperDispatcher` utiliza `time.perf_counter()` para medir tempo decorrido em milissegundos com 2 casas decimais, gravando em `DispatchResult.duration_ms`.
  - **Gravação Atômica:** Tanto `fire_due` (gatilho `schedule`) quanto `run_now` (gatilho `manual`) persistem um registro `JobRun` antes de atualizar o estado do job ou lançar `GatekeeperError`.
  - **Limpeza e Retenção:** No housekeeping diário (e em `POST /housekeeping/purge`), execuções anteriores a `JOB_RETENTION_DAYS` são expurgadas via `repo.purge_old_job_runs(cutoff)`.
  - **Superfície REST:** `GET /jobs/{id}/runs` para inspeção de um job e `GET /jobs/runs` para auditoria geral de disparos (com filtros `status` e `limit`).
  - **UI do Operador:** No drawer lateral de detalhes da agenda (`JobsPage.svelte`), nova seção "Histórico de Disparos" lista as tentativas recentes com badges de status, gatilho (Manual/Agendado), latência em ms e mensagens de erro formatadas.

### [2026-09-19] Dead-Letter e Ação Rápida de Re-enfileiramento (Retry Manual na UI e API)

- **Contexto:** Jobs com erro definitivo (ex: 401/422 no gateway) ou com retentativas esgotadas entram em estado de Dead-Letter (`status: error`, `enabled: false`). Operadores e sistemas externos precisavam inspecionar a causa (`last_error`, `retry_count`) e re-enfileirar manualmente os jobs ou grupos sem precisar recriá-los do zero.
- **Decisão:**
  - **Inspeção Enriquecida:** Modelo `JobListItem` em `GET /jobs` agora inclui `last_error` e `retry_count`, permitindo auditoria visual direta em listagens e filtros sem chamadas `GET /jobs/{id}` individuais.
  - **Endpoint `POST /jobs/{id}/retry`:** Reativa o job: redefine `status = scheduled`, `enabled = true`, `retry_count = 0`, `last_error = null`. Se job `once` com tempo no passado, ajusta `next_run_at` e `run_at` para o instante atual e notifica o loop de vencimento (`notebook_changed.set()`). Retorna 409 para jobs YAML.
  - **Endpoint `POST /jobs/group/{group_id}/retry`:** Re-enfileira em lote todos os jobs do grupo que estejam em `status == error`.
  - **Conclusão com Sucesso em Run-Now:** Ao executar `POST /jobs/{id}/run` em um job pontual previamente em erro, o retorno `202 Accepted` transita o estado para `done`, `enabled = false`, limpando `last_error` e `retry_count`.
  - **UI do Operador:** Métrica "Erros Registrados" funciona como filtro rápido para `status=error`, linhas da tabela destacam Dead-Letter com botão "Retry", e painel lateral exibe banner de Dead-Letter com a mensagem do erro e botões para re-enfileirar ou disparar imediatamente.

### [2026-09-19] Saudações Contextuais e Variáveis Dinâmicas Seguras em Templates

- **Contexto:** Templates de mensagens e lembretes precisavam de saudações adaptadas dinamicamente ao horário local do envio (ex: "Bom dia" / "Boa tarde" / "Boa noite") e granularidade adicional de relógio/calendário (dia do mês numérico, hora, minuto, mês numérico, período) sem abrir brechas de injeção ou usar Jinja2.
- **Decisão:**
  - **Janelas Canônicas de Saudação (pt-BR, `America/Sao_Paulo`):**
    - `05:00` às `11:59` → `Bom dia`, minúsculo `bom dia`, período `manhã`.
    - `12:00` às `17:59` → `Boa tarde`, minúsculo `boa tarde`, período `tarde`.
    - `18:00` às `04:59` → `Boa noite`, minúsculo `boa noite`, período `noite`.
  - **Tags Disponíveis:** `{{greeting}}`, `{{greeting_lower}}`, `{{saudacao}}`, `{{saudacao_lower}}`, `{{period}}`, `{{day}}` (dia do mês 2 dígitos), `{{month}}` (mês 2 dígitos), `{{hour}}` (hora 2 dígitos), `{{minute}}` (minuto 2 dígitos).
  - **Interpolação Segura sem Jinja:** Substituição estrita ordenada pelo comprimento decrescente das tags para evitar mangling de prefixos (ex: `{{day_name}}` antes de `{{day}}`, `{{greeting_lower}}` antes de `{{greeting}}`). Tags desconhecidas permanecem estritamente literais.
  - **Integração End-to-End:** Refletido imediatamente no envio real (`due-tick`), no `POST /jobs/preview`, no MCP stdio e na UI do operador (`TemplatesPage.svelte` com `VALID_TAGS`, simulação reativa e botões de inserção rápida).

### [2026-09-19] Tool de Preview / Dry-Run de Agendamento (MCP preview e POST /jobs/preview)

- **Contexto:** Agentes operando no MCP e chamadores da API precisavam testar e inspecionar previamente a resolução do destinatário (contato e telefone normalizado), o cálculo determinístico do próximo disparo (`next_run_at` em UTC e horário local formatado) e a prévia da mensagem com interpolação de tags de calendário e contato (`{{name}}`, `{{date}}`, `{{time}}`, `{{weekday}}`, `{{day_name}}`, `{{month_name}}`, `{{year}}`) antes de efetivamente persistir no SQLite.
- **Decisão:**
  - **Endpoint `POST /jobs/preview`:** Rota autenticada (`x-api-key`) que executa dry-run completo: resolve destinatário via aliases e catálogo de contatos, avalia expressões de agendamento (`when` amigável/ISO/cron ou `kind`/`run_at`/`cron_expr`), renderiza variáveis com base no `next_run_at` calculado e extrai o mapa de variáveis resolvidas.
  - **Garantia Estrita de Dry-Run:** Operação puramente em memória — zero inserts no repositório SQLite, sem disparo de `asyncio.Event` (`notebook_changed`) e sem contato com o gateway de envio.
  - **Tool MCP `preview`:** Integrada à superfície fechada do MCP stdio (`build_mcp`) chamando `POST /jobs/preview`, mantendo tokens compactos e mensagens de erro amigáveis sem expor CRUD genérico.

### [2026-09-19] Filtros Avançados e Busca na Caneta MCP (list_agenda) e HTTP

- **Contexto:** Agentes operando no MCP e chamadores da API precisavam filtrar jobs por destinatário/alias específico, realizar busca textual (por exemplo "remédio", "condomínio") e consultar janelas temporais relativas ("hoje", "amanhã", "esta semana", "7d", etc.) sem receber listas excessivas.
- **Decisão:**
  - **Tool `list_agenda` Enriquecida:** Novos parâmetros opcionais `to` (alias/telefone), `query` (busca em título/conteúdo) e `period` (janela temporal relativa), preservando a superfície fechada (ADR-005) sem adicionar tools CRUD espúrias.
  - **Resolução de Período Relativo (`parse_period` em `mcp_when.py`):** Suporte determinístico a âncoras de calendário (`hoje`, `amanhã`, `ontem`, `esta semana`, `próxima semana`, `este mês`, dias da semana `segunda`, etc.), durações relativas (`7d`, `+7d`, `próximos 3 dias`, `-24h`, `últimos 7 dias`) e datas ISO (`YYYY-MM-DD`, `YYYY-MM`), convertidas para ISO UTC `from` e `to`.
  - **Busca Textual no Backend:** Parâmetro `query` em `GET /jobs` traduzido no repositório SQLite como `(LOWER(title) LIKE LOWER(?) OR LOWER(COALESCE(content, '')) LIKE LOWER(?))` para busca case-insensitive eficiente.
  - **União de Destinatário/Alias:** Filtro de contato no repositório verifica `target_number = ? OR created_by = ? OR "to" = ?`, garantindo localização do job tanto pelo número resolvido quanto pelo alias literal cadastrado.

### [2026-09-19] Expressões de Intervalo e Calendário Amigáveis no MCP (when)

- **Contexto:** Chamadas de agendamento e reagendamento via MCP (`schedule` e `reschedule`) exigiam instantes estritos em ISO-8601 ou cron de 5 campos, tornando a anotação natural de lembretes pelo agente suscetível a erros de formatação.
- **Decisão:** Resolução de linguagem natural e deltas temporais na caneta do MCP (`mcp_when.py`), preservando o contrato estrito da API HTTP (`POST /jobs` e `POST /jobs/{id}/reschedule`).
- **Capacidades Suportadas:**
  - Intervalos relativos simples e compostos (`+15m`, `2h`, `em 10 minutos`, `daqui a 1 hora e 30 minutos`, `1h30m`, `30s`, `1w`).
  - Datas e horários amigáveis no fuso `America/Sao_Paulo` (`APP_TZ`): `amanhã 14h`, `amanha às 15:30`, `hoje 18:00`, `depois de amanhã 09:00`, dias da semana (`segunda 9h`, `próxima sexta às 18h`) e horários diretos (`14:00`, `18h`).
  - Formatos vigentes intactos: ISO-8601 (com ou sem offset) e cron de 5 campos (com validação estrita dos campos para evitar colisão com frases).
  - Tratamento de erro gracioso: `parse_when` levanta `ValueError` claro e amigável capturado pelo `AgendaApi` como `AgendaToolError`, devolvendo JSON limpo `{"error": "..."}` no MCP.

### [2026-09-15] Agrupamento Visual de Mensagens do Mesmo Lote (wdg-job-list)

- **Contexto:** Registros de jobs criados via `POST /jobs/batch` compartilham `group_id`, mas apareciam como linhas dispersas e repetitivas na tabela de Agendas Registradas (`JobsPage.svelte`).
- **Decisão:** Agrupamento reativo derivado (`jobTableRows`) em Svelte 5. Jobs com `group_id` são consolidados sob uma linha mestra de grupo (`GroupedJobRow`) com resumo de status, prévia de contatos/aliases, ações em lote (`POST /jobs/group/{group_id}/run` e `/cancel`) e alternador expansível.
- **Linhas Filhas:** Exibidas logo abaixo com guia visual (`border-l-4 border-l-secondary/60` e `subdirectory_arrow_right`), mantendo seleção individual, perfil do contato e ações atômicas (`Disparar`, `Editar`, `Cancelar`). Grupos iniciam recolhidos por padrão (`expandedGroups = new Set()`); o clique na linha mestre ou no alternador (`unfold_more` / `Expandir todos`) expande as linhas filhas e inspeciona o primeiro membro.

### [2026-09-13] Tema sempre branco (tokens RGB + alpha)

Canais em `app.css` são `R G B` (espaço). Tailwind 3 injeta `--tw-*-opacity` e, com `rgba(var(--token), a)`, o browser descarta a cor (`rgba(255 255 255, 1)` é inválido). Usar `rgb(var(--token) / a)`. Script inline em `index.html` aplica `class="dark"` / `data-theme` antes do paint.

### [2026-09-13] Remediações do QA Audit da UI (NF-01 a NF-15)

- **Cura Definitiva de Cache Heurístico SPA (NF-01/09):** Respostas de fallback HTML do SPA (`index.html`) no backend (`main.py`) agora incluem cabeçalhos estritos `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache` e `Expires: 0`. No frontend (`api.ts`), todas as chamadas `fetch` utilizam `cache: 'no-store'`. Isso previne que navegadores ou proxies intermediários (Cloudflare) apliquem cache heurístico RFC 7234 e retornem HTML em chamadas subsequentes de API para rotas com o mesmo path (`/templates`, `/contacts`).
- **Acessibilidade e Focus Trapping (NF-06):** Criação da Svelte action reutilizável `focusTrap` (`web/src/lib/focusTrap.ts`) mantendo o ciclo de foco (`Tab`/`Shift+Tab`) estritamente dentro dos diálogos (`ApiKeyModal`, `RescheduleModal`, `ContactPickerModal`, drawer e modal de criação de jobs), com restauração de foco ao elemento disparador no fechamento. Adição de `aria-current="page"` na navegação ativa do `AppShell` (NF-10).
- **Largura de Ações e Layout Desktop (NF-04):** Expansão da largura mínima da coluna de Ações na tabela de agendamentos para `min-w-[195px]` com `flex-nowrap`, eliminando clipping dos botões "EDITAR", "DISPARAR" e Cancelar em telas desktop (>1024px).
- **Robustez do Tema Escuro (NF-05):** Reforço dos seletores CSS em `app.css` (`:root.dark, html.dark, [data-theme="dark"], html[data-theme="dark"], body.dark`), adição de `id` explícitos (`theme-btn-light`, `theme-btn-dark`, `theme-btn-system`) e atributo de acessibilidade `aria-pressed` nos botões de alternância do `AppShell`.
- **Validação de Formulários e Localização (NF-02, NF-03, NF-07, NF-08, NF-12):** Remoção de `novalidate` dos três formulários principais; validação HTML5 nativa com mensagens em português (`setCustomValidity`); aviso reativo para tags desconhecidas em templates com distinção clara entre `{{weekday}}` (dia da semana) e `{{day_name}}` (dia do mês); remoção da exigência arbitrária de prefixo `+` em números de telefone; tradução localizada para erros Pydantic 422 (`localizeDetail`).

### [2026-09-13] Remediações do QA Audit da UI (BUG-001 a BUG-013)

- **Tema Claro / Dark Mode:** Implementação de variáveis CSS para paleta completa em `web/src/app.css` (`:root` e `:root.dark, [data-theme="dark"]`) com helper `withOpacity()` no `web/tailwind.config.js` para suportar modificadores alpha (`bg-tertiary/10`, etc.).
- **Content-Type & Client Resiliency:** `web/src/lib/api.ts` agora envia explicitamente `Accept: application/json` e valida o `Content-Type` de resposta antes de parsear JSON, emitindo `ApiClientError` estruturado caso o servidor devolva HTML/502/404.
- **SPA Fallback no Backend:** `_is_html_request` em `main.py` retorna `False` se `Accept: application/json` estiver presente, garantindo 401/404 JSON nas requisições de API, e `True` em navegações normais de navegador (`Accept: text/html`).
- **Interações & UX:** Remoção de `window.confirm` síncrono bloqueante no cancelamento de jobs; suporte a tecla `Escape` e botão Fechar nos modais/drawers; rolagem horizontal (`min-w-[660px]`/`min-w-[560px]` com `overflow-x-auto`) nas tabelas de Jobs e Contatos para suportar telas menores (~700px); tradução e localização pt-BR de rótulos e chips de status.

### [2026-09-13] Grupos de Envio (Múltiplos Destinatários, group_id no SQLite v7)

- **Contexto:** Necessidade de criar um mesmo agendamento (título, conteúdo/modelo, horário, criador) para múltiplos contatos e gerenciar o envio coletivo ou individual.
- **Decisão:** Abordagem de jobs individuais com chave de agrupamento `group_id TEXT` indexada na tabela `jobs` (`user_version` 7). Preserva o modelo de execução atômico do `due-tick`, permitindo que o sucesso/falha/retry de um destinatário não interfira nos demais.
- **Superfície:** `POST /jobs/batch` (cria os N registros e gera `group_id`), `POST /jobs/group/{group_id}/cancel`, `POST /jobs/group/{group_id}/run` (202 Accepted em lote), e filtro `group_id` no `GET /jobs`. Na UI, chips múltiplos no modal de criação e card de membros no drawer com disparo/cancelamento em lote.

### [2026-09-13] Servir UI estática no FastAPI + Multi-stage Docker

Dockerfile multi-stage: Stage 1 (`node:22-alpine`) compila o Svelte 5 SPA em `web/dist`, Stage 2 (`python:3.13-slim`) copia para `/app/web/dist`.
FastAPI monta `/assets` com `StaticFiles`. Navegação no navegador (`GET`/`HEAD` com `Accept: text/html`) entrega `index.html` (SPA fallback em `/`, 401 de auth de rota e 404), preservando 401/404 JSON estritos para chamadas de API (`Accept: application/json` e mutações).

### [2026-09-13] Porte da UI em Svelte 5 (`web/`)

Porte fiel dos protótipos Stitch (`proto/scr-*`) para Svelte 5 SPA com Tailwind e TypeScript. Chrome extraído em `web/src/layout/AppShell.svelte`, 4 rotas (`/contacts`, `/contacts/{id}`, `/templates`, `/jobs`) em `web/src/pages/`, cliente HTTP tipado em `web/src/lib/api.ts` com `x-api-key` no client e 202 tratado como enfileirado.

### [2026-09-12] UI: operador agora, contas depois

Contrato [INTERFACE.md](INTERFACE.md) **aprovado** com quatro telas e `x-api-key`. Cadastro/login/OTP/senha e “admin vs usuário” **adiados** até validar essa superfície. MCP/scripts continuam na chave; não misturar sessão de pessoa nesta versão.

### [2026-09-12] Catálogo de templates

HTTP `/templates` no SQLite (`user_version` 6). Sem tool MCP. Job: `template_id` **ou** `content`. Snapshot do `body` no create; no disparo o `body` atual do catálogo vence se o id ainda existir. `{{name}}` vem do contato com `phone = target_number`; senão a tag fica literal. Sem Jinja.

### [2026-09-12] Higiene pós-`v0.2.0`

- **Contexto:** Tag + GitHub Release + README/env já existiam; `NOTES.md` ainda era dump de todo o ciclo e o backlog não tinha sido promovido.
- **Decisão:** Enxugar NOTES (o detalhe vive no `git log` e nos ADRs). Corrigir ADR-002 (watch YAML) e ADR-005 (`reschedule`). Reiniciar numeração; próxima tarefa `[00.1]`.

### [2026-09-12] Release `v0.2.0` (não reusar `v0.1.0`)

Tag `v0.1.0` já publicada. HEAD de 12/09 → **`v0.2.0`**. Owner GitHub `yegear1`. Porta HTTP **8003**. Docs públicos sem spec de bot nem repo irmão. Nomes `WHATSAPP_*` no código são históricos.

### [2026-09-12] Docs sem contrato de chat

Canetas versionadas = MCP, HTTP, YAML. Dispatch = `POST /send` genérico. Callers externos usam `/jobs` por conta própria.

### Schema e produto (ciclo até v0.2.0)

- `target_number` no job (migração v1→v2); tick não re-resolve alias.
- `retry_count` (v2→v3): até 3 retries transitórios; 401/422 falham na hora.
- Placeholders no disparo (`templates.py`): relógio + `{{name}}` do contato destino; sem Jinja2. Catálogo SQLite (`/templates`).
- `GET /jobs` e MCP: `status` (inclui `error`) + `limit`. Query `to` = fim de **data**.
- `JOB_RETENTION_DAYS` (padrão 365; `0` desliga). Purge só `done`/`error` sqlite.
- YAML: merge por `id` + reload `mtime` / `POST /routines/reload`.

---

## Contratos vigentes

| Canal | Produtor | Consumidor | Payload |
|---|---|---|---|
| HTTP `/jobs` | MCP, curl, callers | API homelab-schedule | [ENDPOINTS.md](ENDPOINTS.md) |
| HTTP `/contacts` | UI / curl | API homelab-schedule | [ENDPOINTS.md](ENDPOINTS.md) |
| HTTP `/templates` | UI / curl | API homelab-schedule | [ENDPOINTS.md](ENDPOINTS.md) |
| MCP stdio | Agente Cursor | HTTP local | [ADR-005](adr/005-mcp-superficie-fechada.md) |
| `routines.yaml` | Git / operador | Loader + watch | [CHANNELS.md](CHANNELS.md) |
| `POST /send` | Dispatcher | Gateway `WHATSAPP_API_URL` | `phone_number`, `content`, `quote_id`, `x-api-key` |

Alteração de contrato = schemas dos lados na mesma tarefa.

---

## Armadilhas

- **`/send`:** só `phone_number` + `content` + `x-api-key`. Não `to`/`body`/`Authorization`.
- **202:** enfileirado. Retry imediato duplica.
- **Logs:** destino e `content` nunca são stream field.
- **SQLite:** um writer. Esquecer o `Event` após escrita atrasa até o cap de 5 min.
- **YAML vs SQLite:** merge por `id` estável; cancel YAML → `409`.
- **`GET /jobs?to=`:** intervalo de data, não destino. Pessoa: `GET /jobs?phone=`.
- **Tema UI:** não misturar `rgba(var(--rgb-espaço), a)` com tokens `R G B`; o fundo cai no branco do user-agent e o seletor parece morto.

---

## Débitos assumidos

| Débito | Motivo | Quando revisitar |
|---|---|---|
| Sem UI web no v0.2.0 | ADR-003 | Contrato aprovado `[00.4]`; proto/port a seguir |
| Contas / OTP / senha na UI | Validar operador + chave primeiro | Depois da UI atual |
| Sem `created_by` / filtro por telefone | Job só tem destino | Fechado em `[00.2]` (`?phone=`) |
| Contatos só em `WHATSAPP_ALIASES` | Env, não CRUD | Fechado em `[00.1]` (`/contacts`) |
| Templates só data/hora | Sem catálogo nem `{{name}}` | Fechado em `[00.3]` (`/templates`) |
| Sem HA / multi-réplica | Um SQLite + um tick | Se houver segundo host |
