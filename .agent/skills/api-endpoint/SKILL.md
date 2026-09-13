---
name: api-endpoint
description: Implementar ou evoluir rotas HTTP do homelab-schedule (FastAPI, Pydantic v2, router fino → service → repository).
---

# Construção de Endpoints REST (`api-endpoint`)

## 1. Contexto e Objetivo

Padroniza rotas HTTP deste serviço: tipagem Pydantic ponta a ponta, camadas desacopladas, contratos em `.agent/ENDPOINTS.md`.

---

## 2. Quando Utilizar (Gatilhos)

- Nova rota (`POST /jobs`, `GET /jobs/{id}`, etc.).
- Query, path ou body novo em rota existente.
- Novos status HTTP ou exception handlers.

---

## 3. Ferramentas e Servidores MCP Relacionados

- **MCP(s):** nenhum para mutar schema. Depois de `[02.2]`, não exponha a rota nova no MCP sem a skill `mcp-tool` e o ADR-005.
- **Validação:** `uv run pytest -v`, `uv run ruff check .`, `uv run mypy .`.

---

## 4. Procedimento Operacional Passo a Passo

### Passo 1: Contrato primeiro

1. Atualize `.agent/ENDPOINTS.md` se o comportamento for novo.
2. Schemas em `src/schemas/` (Pydantic v2). Request, response, erros. Sem `dict`/`Any`.
3. Auth: `x-api-key` = `SCHEDULE_API_KEY`, exceto `/health`.

### Passo 2: Camadas

1. **Router:** valida, chama o service, status HTTP (`201` create, `200` leitura, `204` cancel sem body se for o caso). Sem SQL e sem httpx no router.
2. **Service:** regras (alias → destino não acontece aqui se for dispatch — isso é `whatsapp-dispatch`). Exceções de domínio tipadas.
3. **Repository:** SQLite. YAML não se apaga pelo repository de delete — `409`.

### Passo 3: Erros

Handler global: `EntityNotFound` → 404; validação → 422; `Unauthorized` → 401; `YamlJobImmutable` → 409; gateway down em run-now → 502. Sem path de arquivo nem keys na resposta.

### Passo 4: Testes

Caminho feliz, 401, 422, 404, 409 (yaml). `TestClient` / httpx. Jobs YAML vs sqlite cobertos quando o loader existir.

### Passo 5: Governança

Linha na tabela de contratos em `.agent/NOTES.md` se o canal mudou.

---

## 5. Exemplo canônico (Python)

```python
from pydantic import BaseModel, Field


class CreateJobRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1)
    to: str = "eu"
    kind: str
    run_at: str | None = None
    cron_expr: str | None = None


async def create_job_route(payload: CreateJobRequest) -> JobResponse:
    job = await job_service.create(payload)
    return job
```

Router devolve `JSONResponse` com status 201; a função acima é ilustrativa — use `response_model` do FastAPI.

---

## 6. Armadilhas

- ⚠️ Não retornar `200` com `{ "status": "error" }`.
- ⚠️ Não falar com o gateway no router (skill `whatsapp-dispatch`).
- ⚠️ Não expor `PATCH` genérico (ADR-005 / ENDPOINTS: cancel + create).
- 💡 `GET /jobs` lista curta; `content` completo só no get por id.

---

## 7. Checklist

- [ ] ENDPOINTS.md alinhado
- [ ] Schemas Pydantic sem `Any`
- [ ] Router sem SQL/httpx de negócio
- [ ] Testes 2xx e erro
- [ ] NOTES.md se o contrato mudou
