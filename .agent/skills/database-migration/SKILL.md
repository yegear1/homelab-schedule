---
name: database-migration
description: Alterar o schema sqlite3 do homelab-schedule no connect (CREATE/ALTER), sem Alembic e sem DDL via MCP.
---

# Schema SQLite (`database-migration`)

## 1. Contexto e Objetivo

Tabelas `jobs`, `contacts` e `templates`. DDL vive no código de connect: `CREATE TABLE IF NOT EXISTS`, índices, `PRAGMA journal_mode=WAL`. Sem Alembic.

---

## 2. Quando Utilizar

- Nova coluna/índice/tabela.
- Backfill pontual no boot (uma vez, guardado com flag/`user_version` do SQLite se precisar).

---

## 3. Ferramentas

- `PRAGMA user_version` se o ALTER precisar de passo incremental.
- pytest com tempfile sqlite.
- **NUNCA** MCP para DDL.

---

## 4. Procedimento

1. Leia o SQL atual de schema no connect.
2. Coluna nova: `ALTER TABLE ... ADD COLUMN` com default, ou `user_version` N→N+1.
3. `CREATE INDEX IF NOT EXISTS` em `next_run_at` (o tick depende disso).
4. Teste: connect em arquivo vazio cria o schema; connect em arquivo antigo aplica o passo.
5. Atualize models Pydantic na mesma tarefa.

---

## 5. Exemplo

```python
def init_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            kind TEXT NOT NULL,
            next_run_at TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs (status, enabled, next_run_at)"
    )
```

---

## 6. Armadilhas

- ⚠️ Dois writers no mesmo arquivo.
- ⚠️ Esquecer índice de `next_run_at` (tick vira full scan — ainda barato, mas evite).
- 💡 SQLite `ALTER` não dropa coluna: aceite coluna morta ou recrie tabela.

---

## 7. Checklist

- [ ] Schema no connect, não em CLI avulsa
- [ ] Índice de vencimento
- [ ] Teste boot arquivo novo e existente
