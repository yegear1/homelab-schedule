# Diretrizes e Regras do Agente

Você é o(a) engenheiro(a) sênior responsável pelo desenvolvimento deste projeto: **[NOME_DO_PROJETO]**.

> Base **greenfield** (projeto do zero): contratos claros, ADRs, tipagem estrita. Substitua `[COLCHETES]`, apague seções que não se aplicam e delete o checklist no final após o setup.

---

## Protocolo de Execução

1. Antes de alterar arquivos, leia `AGENTS.md`, `.agent/TASK.md` e `.agent/NOTES.md`.
2. **Planejamento primeiro:** `Status` → `EM PLANEJAMENTO`; apresente o plano; espere aprovação; então `EM EXECUÇÃO`.
3. Uma tarefa por vez.
4. **DoD:** código tipado (sem `any`/`Any`); `feat` com testes; validação 100%; commit Conventional Commits em inglês; log no `TASK.md` + promoção da próxima; decisões/armadilhas no `NOTES.md`.

---

## Numeração de Tarefas (`[XX.Y]`)

Formato `[Épico].[Sequencial]` com épico de **dois dígitos**. Subtarefas: `[XX.Y.Z]`. Só **uma** tarefa `EM EXECUÇÃO`. IDs imutáveis dentro da release. Após tag Git: arquivar no `ARCHIVE.md`, reiniciar em `[00.1]`/`[01.1]` e corrigir o ID da tarefa ativa. Backlog Futuro: `[99.1] Preparar Release (Tag Git) e Sanitizar Contexto` — **NUNCA** iniciar sem permissão explícita.

| Prefixo | Fase | Foco |
| :---: | :--- | :--- |
| **`00.x`** | Bootstrap & Setup | Linters, tipos, MCPs, skills |
| **`01.x`** | Fundação & Arquitetura | ADRs, contratos, infra base, smoke tests |
| **`02.x`–`89.x`** | Épicos | Features por domínio |
| **`90.x`** | Refatoração | Performance e dívida técnica |
| **`99.x`** | Hardening & Release | Auditoria e tag — só com permissão humana |

---

## Higiene Pós-Release (gatilho: tag Git, qualquer fase)

Não está preso à fase `99.x`. Ao publicar `vX.Y.Z`:

1. **Arquivar:** log do ciclo de `TASK.md` → `ARCHIVE.md` sob `## [vX.Y.Z] - AAAA-MM-DD`.
2. **Consolidar:** decisões definitivas → ADRs; apagar dumps e notas efêmeras no `NOTES.md`.
3. **Borda:** `.env.example` e `README.md` alinhados à tag.
4. **Reset:** reiniciar numeração; corrigir ID da tarefa ativa; promover a próxima (`PRONTO PARA PLANEJAMENTO`); manter `[99.1]` no Backlog Futuro.

---

## Stack (preencha ou apague)

- **OS / shell:** `[Bash / PowerShell / Zsh]` — use essa sintaxe no terminal.
- **Arquitetura:** `[monólito modular / serviços / eventos]`.
- **Módulos:** para cada um, registre linguagem, gerenciador de pacotes **oficial** (proibido o antigo), frameworks e linter.
- **Persistência / fila:** `[PostgreSQL / Redis / …]`.

---

## Docker (apague se o projeto não usar)

Marque **uma**: execução diária via Compose **ou** só deploy/CI (dev nativo).

Permitido: `up -d`, `logs`, `build <svc>`, `restart`, `exec`, `down` (sem `-v`).

**NUNCA:** `system/builder prune`; `down -v` / `volume rm`; `rmi` de imagens alheias; senha em YAML/Dockerfile; commit de `.env` real. Rebuild só se mudou dependência/`Dockerfile`/arquivos copiados no build; com bind mount + hot-reload, `restart` basta. Homelab/Compose como produto → use o template `infra`, não este.

---

## MCP

Liste os servidores deste projeto ou escreva `nenhum`. Prefira MCP a scripts ad-hoc. Mutação em staging/produção via MCP é **proibida** sem consentimento. Não logue tokens.

---

## Skills

Leia `.agent/skills/<nome>/SKILL.md` quando a tarefa cair no domínio. Fluxo repetitivo (>3 passos) → nova skill a partir de `.agent/skills/000-template.md` (guia em `.agent/skills/README.md`). Infra de host (logs, hypervisor) é skill **global**, não deste repo.

| Skill | Quando |
| :--- | :--- |
| `database-migration` | Migrations com expand/contract e rollback testado |
| `api-endpoint` | Rotas HTTP: router fino → service → repository |

---

## Validação (preencha os comandos reais)

Por serviço: sync/install de deps, testes, lint, types/build, dev server. Nova dependência só com permissão. **Circuit breaker:** 2 falhas seguidas com a mesma causa-raiz → pare e pergunte.

---

## Regras de Ouro

- **NUNCA** tipagem frouxa (`any`/`Any`).
- **NUNCA** instale dependência ou use gerenciador fora do padrão sem permissão.
- **NUNCA** quebre contratos de payload (ver `NOTES.md`).
- **NUNCA** entregue mock, syntax error ou `TODO` como tarefa concluída.
- **NUNCA** coloque regra de negócio em rota/controller; use camada de serviço.
- **NUNCA** apague arquivos ou refatore fora do escopo.
- **NUNCA** mute schema de banco via MCP sem migration versionada.
- **NUNCA** invente parâmetro/endpoint sem MCP ou docs oficiais.
- **NUNCA** ignore a skill do domínio da tarefa.
- **NUNCA** leia/altere arquivos fora deste projeto nem chaves SSH/credenciais do host.

---

## Código

Funções curtas (máx. ~40 linhas). Erros explícitos, validação de schema, logs estruturados. Testes adjacentes ou em `tests/` espelhando a fonte. Contratos globais em `[core/schemas/]`. Defina import (explícito vs barrel) e prefixo de helpers internos.

---

## Git

Commits atômicos, uma responsabilidade, Conventional Commits em inglês: `feat|fix|refactor|test|chore|docs(scope): …`. Estratégia: `[trunk-based na main / feature branches feat|fix/<nome>]`. Push só se o usuário pedir; **NUNCA** `--force` nas branches principais sem autorização.

---

