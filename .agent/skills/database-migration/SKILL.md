---
name: database-migration
description: Procedimento canônico para planejamento, criação, teste e execução de migrações de schema de banco de dados com suporte a rollback e compatibilidade retroativa.
---

# Migrações de Banco de Dados (`database-migration`)

## 1. Contexto e Objetivo
Esta habilidade ensina o agente a realizar alterações de estrutura e dados em bancos relacionais (PostgreSQL, MySQL, SQLite, etc.) com **segurança operacional máxima**, garantindo que as mudanças sejam reversíveis (rollback), não causem lock excessivo de tabelas e mantenham a compatibilidade retroativa (*zero-downtime migrations*).

---

## 2. Quando Utilizar (Gatilhos)
Ative as diretrizes desta skill sempre que a tarefa envolver:
- Criação de novas tabelas ou views.
- Adição, renomeação, alteração de tipo ou remoção de colunas.
- Criação ou remoção de índices (`CREATE INDEX`, índices únicos, compostos).
- Criação ou ajuste de constraints (`FOREIGN KEY`, `CHECK`, `NOT NULL`).
- Migrações de dados (*data backfills*) em tabelas existentes.

---

## 3. Ferramentas e Servidores MCP Relacionados
- **MCP(s) Utilizados:** Servidor MCP de banco de dados do ambiente (ex: `postgres-mcp`) para inspecionar schemas e índices existentes (estritamente em operações *read-only* de discovery).
- **Ferramentas de CLI / Migrations:** Ferramenta oficial definida no projeto (ex: `alembic`, `prisma migrate`, `knex`, `golang-migrate`, `flyway`, `diesel`).

---

## 4. Procedimento Operacional Passo a Passo

### Passo 1: Inspeção Prévia e Contratos
1. Consulte o schema atual do banco via MCP ou arquivos de model/schema do projeto.
2. Verifique a seção de **Contratos de Dados Vigentes** em `.agent/NOTES.md` para entender quais serviços ou queries dependem dos campos afetados.
3. Se houver dependências críticas entre serviços, confirme se a alteração exige versionamento de payload.

### Passo 2: Aplicação do Padrão *Expand and Contract*
Para evitar quebra em produção durante a fase de transição (código novo rodando simultaneamente ao código antigo):
- **Adicionar coluna obrigatória (`NOT NULL`):**
  1. *Fase 1 (Expand):* Adicione a coluna como opcional (`NULL`) ou com um valor `DEFAULT` seguro.
  2. *Fase 2 (Backfill):* Popule registros existentes se necessário.
  3. *Fase 3 (Contract):* Adicione a restrição `NOT NULL` apenas após garantir que todo o tráfego ativo envia o novo campo.
- **Renomear ou remover coluna:**
  1. Nunca remova ou renomeie diretamente. Adicione o novo campo, migre as leituras/escritas no código e remova o campo antigo em uma release posterior.

### Passo 3: Criação da Migration Versionada
1. Gere o arquivo de migration utilizando o comando oficial do gerenciador do projeto.
2. **Obrigatoriedade de Rollback:** Toda migration DEVE conter instruções explícitas de reversão (`down` ou script de rollback correspondente). Migrações irreversíveis são proibidas, salvo justificativa explícita registrada em `.agent/NOTES.md`.
3. Garanta que o nome do arquivo seja descritivo (ex: `20260903_add_status_index_to_orders.sql`).

### Passo 4: Ciclo de Validação Local
Antes de submeter a tarefa:
1. Execute a migração para frente: `apply` / `migrate`.
2. Verifique se o schema foi alterado conforme o esperado.
3. Execute a reversão da migração: `rollback` / `down`.
4. Verifique se o schema voltou exatamente ao estado anterior sem erros.
5. Reaplique a migração: `migrate` para deixar o ambiente no estado desejado.

### Passo 5: Atualização de Models e Governança
1. Atualize os models e schemas correspondentes na aplicação (ex: SQLAlchemy, Prisma Schema, Pydantic, Zod).
2. Se a migração alterou um contrato compartilhado de payload ou banco, documente a mudança em `.agent/NOTES.md`.

---

## 5. Padrões de Código e Exemplo Canônico

```sql
-- Exemplo canônico de Migration (PostgreSQL) com suporte a rollback seguro

-- =============================================================================
-- UP: Aplicação da Mudança
-- =============================================================================
-- 1. Adiciona coluna com valor default seguro (evita lock demorado em Postgres moderno)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(32) NOT NULL DEFAULT 'PENDING';

-- 2. Criação de índice concorrente para evitar lock de escrita em tabelas volumosas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_delivery_status 
ON orders (delivery_status);

-- =============================================================================
-- DOWN: Reversão da Mudança
-- =============================================================================
-- 1. Remove o índice primeiro
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_delivery_status;

-- 2. Remove a coluna adicionada
ALTER TABLE orders 
DROP COLUMN IF EXISTS delivery_status;
```

---

## 6. Armadilhas Conhecidas e Anti-Padrões
- ⚠️ **NÃO FAÇA:** `ALTER TABLE ... DROP COLUMN` direto em produção sem período prévio de depreciação.
- ⚠️ **NÃO FAÇA:** Migrações que alteram schemas de banco diretamente via comandos avulsos do MCP sem criar arquivos de migration versionados no repositório.
- ⚠️ **NÃO FAÇA:** Criar índices em tabelas massivas sem utilizar criação concorrente (`CONCURRENTLY` no Postgres) se o banco suportar.
- 💡 **FAÇA:** Testar sempre o ciclo completo `up` -> `down` -> `up` no ambiente de desenvolvimento local.
- 💡 **FAÇA:** Manter migrações atômicas e focadas em uma única entidade ou conjunto coeso de alterações.

---

## 7. Checklist de Conclusão da Skill
- [ ] Arquivo de migration gerado seguindo o padrão oficial da ferramenta do projeto.
- [ ] Método de rollback (`down`) implementado e funcional.
- [ ] Ciclo `apply` -> `rollback` -> `apply` testado localmente com sucesso.
- [ ] Models e schemas da aplicação atualizados e com tipagem estrita condizente.
- [ ] Contratos vigentes e eventuais armadilhas registradas em `.agent/NOTES.md`.
