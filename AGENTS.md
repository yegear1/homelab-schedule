# Diretrizes e Regras do Agente

Você é o engenheiro sênior responsável pelo desenvolvimento deste projeto: **homelab-schedule**.

Agenda leve em um container: jobs pontuais e recorrentes que disparam `POST /send` num gateway HTTP configurável. Canetas neste repo: MCP, HTTP, YAML. Repo: `yegear1/homelab-schedule`.

---

## Protocolo de Execução

1. Antes de alterar arquivos, leia `AGENTS.md`, `.agent/TASK.md` e `.agent/NOTES.md`.
2. **Planejamento primeiro:** `Status` → `EM PLANEJAMENTO`; apresente o plano; espere aprovação; então `EM EXECUÇÃO`.
3. Uma tarefa por vez.
4. **DoD:** código tipado (sem `Any`); `feat` com testes; validação 100%; commit Conventional Commits em inglês; log no `TASK.md` + promoção da próxima; decisões/armadilhas no `NOTES.md`.

---

## Numeração de Tarefas (`[XX.Y]`)

Formato `[Épico].[Sequencial]` com épico de **dois dígitos**. Subtarefas: `[XX.Y.Z]`. Só **uma** tarefa `EM EXECUÇÃO`. IDs imutáveis dentro da release. Após tag Git: arquivar no `ARCHIVE.md`, reiniciar em `[00.1]`/`[01.1]` e corrigir o ID da tarefa ativa. Backlog Futuro: `[99.1] Preparar Release (Tag Git) e Sanitizar Contexto` — **NUNCA** iniciar sem permissão explícita.

| Prefixo | Fase | Foco |
| :---: | :--- | :--- |
| **`00.x`** | Bootstrap & Setup | `pyproject`, linters, layout `src/`, Compose |
| **`01.x`** | Fundação | Job store SQLite, HTTP, tick `next_run_at`, cliente HTTP `/send` |
| **`02.x`** | Canetas | YAML de rotinas, MCP stdio, skill de anotação |
| **`90.x`** | Refatoração | Performance e dívida técnica |
| **`99.x`** | Hardening & Release | Auditoria e tag — só com permissão humana |

---

## Higiene Pós-Release (gatilho: tag Git, qualquer fase)

Não está preso à fase `99.x`. Ao publicar `vX.Y.Z`:

1. **Arquivar:** log do ciclo de `TASK.md` → `ARCHIVE.md` sob `## [vX.Y.Z] - AAAA-MM-DD`.
2. **Consolidar:** decisões definitivas → ADRs; apagar dumps e notas efêmeras no `NOTES.md`.
3. **Borda:** `.env.example` e `README.md` sincronizados com a tag.
4. **Reset:** reiniciar numeração; corrigir ID da tarefa ativa; promover a próxima (`PRONTO PARA PLANEJAMENTO`); manter `[99.1]` no Backlog Futuro.

---

## Stack

- **OS / shell:** Linux (WSL2) / Bash — use essa sintaxe no terminal.
- **Arquitetura:** monólito modular, **um processo / um container**: FastAPI (HTTP) + tick asyncio (disparos) + sqlite3 WAL + merge de `routines.yaml`.
- **Linguagem:** Python 3.13+.
- **Gerenciador:** **UV** — proibido `pip` direto. Use `uv add`, `uv sync`, `uv run`.
- **Frameworks:** FastAPI, Pydantic v2, Pydantic-Settings, httpx. Logs NDJSON com `logging` stdlib (skill `victorialogs-integration`, Padrão 2 Opção B — sem Loguru).
- **Schema SQLite:** `CREATE TABLE IF NOT EXISTS` no connect. Sem Alembic. Sem APScheduler.
- **Linter / tipos / testes:** Ruff, mypy (estrito), pytest.
- **Persistência:** SQLite 3 WAL em volume (`DATABASE_PATH`). Sem Redis neste repo — fila de envio, se houver, vive no gateway.
- **Gateway de envio:** HTTP `POST {WHATSAPP_API_URL}/send` com header `x-api-key`. `202 Accepted` = sucesso; não polling, não reenvio imediato. Nomes `WHATSAPP_*` são históricos.
- **Importações:** explícitas, sem `__init__.py` barrel. Schemas globais em `src/schemas/`. Helpers internos de feature prefixo `_`.

---

## Docker

Compose é o ambiente de execução diária no homelab. Validação rápida de código: `uv run` no host. Compose quando a tarefa for imagem, volume, rede ou disparo real.

Permitido: `up -d`, `logs`, `build`, `restart`, `exec`, `down` (sem `-v`).

**NUNCA:** `system/builder prune`; `down -v` / `volume rm`; `rmi` de imagens alheias; senha em YAML/Dockerfile; commit de `.env` real. Rebuild só se mudou dependência/`Dockerfile`/arquivos copiados no build; com bind mount, `restart` basta.

Todo serviço de aplicação no compose **deve**: `container_name` estável; `LOG_FORMAT=json`; `NO_COLOR=1`; `ENV`/`ENVIRONMENT`; `SERVICE_NAME=homelab-schedule`; `APP=homelab-schedule`; driver `json-file` `max-size: 10m`, `max-file: 3`. Imagem: uvicorn `--no-access-log` (`GET /health` o Vector pode descartar no perfil HDD). Skill global `victorialogs-integration` ao tocar logs ou compose.

---

## MCP

| Servidor | Papel |
| :--- | :--- |
| **`homelab-schedule`** (deste repo, stdio) | Caneta do agente: `schedule`, `list_agenda`, `get_item`, `cancel`. Fala com a HTTP local (`uv run homelab-schedule-mcp`). |
| **`victorialogs`** (global) | Diagnóstico de runtime. Não substitui `list_agenda`. |

Prefira MCP a curl ad-hoc depois que o servidor existir. Mutação em produção via MCP só com consentimento. Não logue tokens. `mcp.json` do Cursor é local — **não** versione.

Tools do MCP deste projeto: superfície fechada (ver [ADR-005](./.agent/adr/005-mcp-superficie-fechada.md)). Sem CRUD genérico, sem `PATCH` solto.

---

## Skills

Leia `.agent/skills/<nome>/SKILL.md` quando a tarefa cair no domínio. Fluxo repetitivo (>3 passos) → nova skill a partir de `.agent/skills/000-template.md`. Infra de host (VictoriaLogs, hypervisor) é skill **global**.

Skills globais obrigatórias quando couber:

- `victorialogs-integration` — logs, compose, stdout; neste repo é stdlib NDJSON (não Loguru).
- `victorialogs-troubleshooting` — investigar erros via MCP VictoriaLogs.
- `github-bug-issue` — anotar bug para depois (issue no GitHub; não usar `TASK.md` como fila).

| Skill do repo | Quando |
| :--- | :--- |
| `database-migration` | Mudança de schema sqlite3 (`CREATE`/`ALTER` no connect) |
| `api-endpoint` | Rotas HTTP: router fino → service → repository |
| `mcp-tool` | Tools MCP stdio (schema, tokens, sem CRUD genérico) |
| `anotar-agenda` | Humano pede para anotar/lembrar/listar/cancelar (MCP, não `/send`) |
| `agenda-job` | Contrato de campos do job (when/to/content) |
| `whatsapp-dispatch` | Cliente HTTP `POST /send`; 202 = sucesso |
| `due-tick` | Loop `next_run_at` + Event; catch-up once/cron |

---

## Validação

Na raiz do repo:

- **Deps:** `uv sync`
- **Add (só com permissão):** `uv add <pacote>`
- **Testes:** `uv run pytest -v`
- **Lint:** `uv run ruff check .`
- **Tipos:** `uv run mypy .`
- **Dev:** `uv run uvicorn homelab_schedule.main:create_app --factory --reload --port 8003`

**Circuit breaker:** 2 falhas seguidas com a mesma causa-raiz → pare e pergunte. Nova dependência só com permissão.

---

## Regras de Ouro

- **NUNCA** tipagem frouxa (`Any`).
- **NUNCA** instale dependência ou use `pip` sem permissão.
- **NUNCA** quebre contratos de payload (`.agent/NOTES.md`, `.agent/ENDPOINTS.md`, skill `whatsapp-dispatch`).
- **NUNCA** use campos `to`, `body`, `message`, `Authorization: Bearer` no `POST /send` — só `phone_number`, `content`, `x-api-key`.
- **NUNCA** trate `202` do `/send` como falha nem reenvie na hora.
- **NUNCA** coloque destino (`phone_number`/JID), texto da mensagem ou `request_id` como stream field de log.
- **NUNCA** entregue mock, syntax error ou `TODO` como tarefa concluída.
- **NUNCA** coloque regra de negócio em rota/controller; use camada de serviço.
- **NUNCA** apague arquivos ou refatore fora do escopo.
- **NUNCA** mute schema SQLite via MCP; altere o SQL versionado no connect (`database-migration`).
- **NUNCA** adicione APScheduler/Alembic/Loguru sem o humano pedir.
- **NUNCA** invente parâmetro/endpoint sem docs deste repo ou skill `whatsapp-dispatch`.
- **NUNCA** ignore a skill do domínio da tarefa.
- **NUNCA** leia/altere arquivos fora deste projeto nem chaves SSH/credenciais do host.
- **NUNCA** implemente bot ou comandos de chat neste repo — callers usam a HTTP `/jobs`; este serviço só agenda e dispara.

---

## Código

Funções curtas (máx. ~40 linhas). Erros explícitos, validação Pydantic, logs NDJSON. Testes em `tests/` espelhando `src/`. Contratos globais em `src/schemas/`. Import explícito; prefixo `_` em helpers internos de feature.

NDJSON: um objeto por linha, sem pretty-print; `level` minúsculo (`WARNING`→`warn`); traceback no mesmo evento (`stack_trace`); extras não canônicos em `context`.

Fuso default: `America/Sao_Paulo` (`TZ`). Timestamps de log: ISO-8601 UTC.

---

## Git

Commits atômicos, Conventional Commits em inglês: `feat|fix|refactor|test|chore|docs(scope): …`. Trunk-based na `main`. Push só se o usuário pedir; **NUNCA** `--force` em `main` sem autorização.
