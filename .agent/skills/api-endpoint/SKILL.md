---
name: api-endpoint
description: Procedimento canônico para implementação e evolução de endpoints HTTP/REST com tipagem estrita, separação em camadas (Router -> Service -> Repository) e validação de contratos.
---

# Construção de Endpoints REST (`api-endpoint`)

## 1. Contexto e Objetivo
Esta habilidade padroniza a criação e evolução de endpoints HTTP/REST no projeto, garantindo **tipagem estrita ponta a ponta**, **arquitetura em camadas desacoplada** e **contratos de dados previsíveis** para clientes web, mobile ou outros serviços.

---

## 2. Quando Utilizar (Gatilhos)
Ative as diretrizes desta skill sempre que a tarefa envolver:
- Criação de uma nova rota HTTP (ex: `POST /orders`, `GET /users/{id}`).
- Adição de novos parâmetros, queries ou corpos de requisição a endpoints existentes.
- Refatoração de rotas para melhorar performance ou desacoplamento.
- Implementação de novos códigos de resposta HTTP ou tratamento de exceções na API.

---

## 3. Ferramentas e Servidores MCP Relacionados
- **MCP(s) Utilizados:** Servidores de documentação de API ou MCP de banco de dados para checar schemas existentes.
- **Ferramentas de Validação e Teste:** Test runners HTTP (ex: `pytest` com `httpx`/`TestClient`, `vitest`/`jest` com `supertest`, `go test`).

---

## 4. Procedimento Operacional Passo a Passo

### Passo 1: Definição do Contrato (Schemas Primeiro)
Antes de escrever a rota, defina explicitamente os schemas de validação com tipagem estrita:
1. **Request Schema:** Tipagem obrigatória de Body, Query Parameters e Path Parameters (ex: Pydantic, Zod, structs tipadas).
2. **Response Schema:** Tipagem do payload retornado para sucesso (200/201) e formato padronizado de erro (400/404/422/500).
3. Nunca permita que campos desconhecidos passem sem validação.

### Passo 2: Separação Estrita de Camadas
A implementação DEVE respeitar 3 camadas com responsabilidades isoladas:

1. **Controller / Router (Camada Web Fina):**
   - Extrai parâmetros e valida o payload com o schema.
   - Invoca o caso de uso / serviço.
   - Retorna o status HTTP correto (`201` para criação, `200` para leitura/atualização com body, `204` para sucesso sem body).
   - ⚠️ **PROIBIDO:** Executar queries SQL, chamar ORM ou processar regras de negócio diretamente no controller.
2. **Service / Use Case (Regra de Negócio Pura):**
   - Orquestra as regras do domínio (cálculos, validações de negócio, disparos de eventos).
   - Não depende de objetos do framework HTTP (não recebe `Request`, `Response` ou `Headers`).
   - Lança exceções de domínio tipadas (ex: `EntityNotFoundException`, `InsufficientFundsException`).
3. **Repository / Gateway (Acesso a Dados):**
   - Encapsula consultas ao banco de dados ou chamadas a APIs externas.

### Passo 3: Tratamento Padronizado de Erros
- Exceções de negócio devem ser interceptadas por um Middleware/Exception Handler global e convertidas no código HTTP correspondente:
  - `EntityNotFoundException` ➔ `404 Not Found`
  - `ValidationException` / Schema Inválido ➔ `422 Unprocessable Entity` ou `400 Bad Request`
  - `UnauthorizedException` ➔ `401 Unauthorized`
  - `ForbiddenException` ➔ `403 Forbidden`
  - `ConflictException` ➔ `409 Conflict`
- Nunca exponha stack traces ou mensagens internas de infraestrutura ao cliente externo.

### Passo 4: Testes Automatizados de Integração
Para cada novo endpoint, escreva testes automatizados cobrindo:
1. **Caminho Feliz:** Requisição válida retorna status esperado (`200 OK` ou `201 Created`) com payload correspondente.
2. **Validação Inválida:** Envio de payload fora do schema retorna `400` ou `422` com mensagens de erro legíveis.
3. **Casos Limite:** Entidade não encontrada (`404`) ou violação de unicidade (`409`).

### Passo 5: Registro em Governança
Documente o novo endpoint na tabela de **Contratos de Dados Vigentes** em `.agent/NOTES.md` indicando rota, método e schema associado.

---

## 5. Padrões de Código e Exemplo Canônico

```typescript
// Exemplo canônico de separação de camadas em TypeScript/Zod

// 1. SCHEMAS (Contrato Estrito)
export const CreateUserRequestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;

// 2. CONTROLLER (Fino - Sem regra de negócio)
export async function createUserController(req: Request, res: Response) {
  // Validação estrita do payload
  const validatedPayload = CreateUserRequestSchema.parse(req.body);
  
  // Delegação para a camada de serviço
  const createdUser = await userService.createUser(validatedPayload);
  
  return res.status(201).json(createdUser);
}

// 3. SERVICE (Regra de Negócio Pura)
export class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new EmailAlreadyInUseError(data.email);
    }
    return this.userRepository.save(data);
  }
}
```

---

## 6. Armadilhas Conhecidas e Anti-Padrões
- ⚠️ **NÃO FAÇA:** Retornar `200 OK` contendo `{ status: "error", message: "..." }`. Utilize status codes HTTP semânticos.
- ⚠️ **NÃO FAÇA:** Escrever consultas de banco de dados (`SELECT ...`) dentro de arquivos de rotas ou controllers.
- ⚠️ **NÃO FAÇA:** Utilizar tipos genéricos ou soltos (`any`, `Object`, `dict`) para inputs ou outputs de endpoints.
- 💡 **FAÇA:** Validar tanto parâmetros de rota (`/users/:id`), query params (`?page=1`) quanto bodies JSON com schemas estritos.
- 💡 **FAÇA:** Isolar exceções de infraestrutura de modo que nunca vazem credenciais, queries SQL ou paths de servidor para a resposta HTTP.

---

## 7. Checklist de Conclusão da Skill
- [ ] Schemas de Request e Response definidos com tipagem estrita (sem `any`).
- [ ] Controller livre de regras de negócio e consultas a banco de dados.
- [ ] Serviço implementado e desacoplado de dependências HTTP.
- [ ] Códigos de status HTTP semânticos (201, 204, 400, 404, etc.) aplicados.
- [ ] Testes automatizados de integração cobrindo caminho de sucesso e de erro.
- [ ] Novo contrato mapeado em `.agent/NOTES.md`.
