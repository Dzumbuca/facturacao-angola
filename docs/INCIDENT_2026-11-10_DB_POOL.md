# Incidente 2026-11-10 — pool de ligações Supabase esgotado

## Sintoma

- Páginas autenticadas (dashboard `/`) devolviam “This page couldn't load — A server error occurred”.
- Digest apresentado: **1439240581**.
- Logs Vercel:

```text
Error [PrismaClientUnknownRequestError]:
Invalid `prisma.payment.findMany()` invocation:
Error in connector: FATAL: (EMAXCONNSESSION) max clients reached in session mode
- max clients are limited to pool_size: 15
```

## Causa

A `DATABASE_URL` de produção apontava para o **pooler Supabase em modo sessão**
(`aws-0-eu-west-1.pooler.supabase.com:5432`). Cada instância serverless da Vercel abre a sua
própria ligação; com funções concorrentes, o limite de 15 clientes em modo sessão
era atingido. Todas as queries seguintes falhavam — dashboard, facturas, auth, etc.

## Correção aplicada

`DATABASE_URL` de produção passou para o **pooler em modo transação**:

```text
postgresql://...@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
  ?pgbouncer=true&connection_limit=1&pool_timeout=20
```

- `pgbouncer=true` desativa prepared statements (necessário no pooler).
- `connection_limit=1` evita que cada função abra mais do que uma ligação.
- Redeploy da produção para aplicar a variável.

Testado previamente com Prisma contra a base de produção:

- `tenant.count()` OK;
- `$transaction(async (tx) => ...)` (transação interativa) OK;
- `$transaction([...])` (batch) OK.

## Verificação

| Evidência | Resultado |
|---|---|
| Logs do deployment antigo (`dpl_5qf1…`) | 15 `EMAXCONNSESSION`, 12 respostas 500 |
| Logs do deployment novo (`dpl_GQni…`) | **0** `EMAXCONNSESSION`, **0** respostas 500 |
| 20 logins concorrentes (credenciais erradas, exercita lookup na BD) | 20× 302, sem erros de BD |
| `pg_stat_activity` | 1 ligação ativa, limite 60 |

Os erros `CredentialsSignin` nos logs são esperados (password deliberadamente errada no teste).

## Notas / prevenção

- Migrations e scripts locais continuam a usar a porta **5432** (`.env.production.local`);
  o pooler de transação é apenas para o runtime serverless.
- Não usar transações interativas longas no pooler de transação.
- Monitorizar `EMAXCONNSESSION` nos logs e o número de ligações no Supabase.
- Rollback: repor a URL com `:5432` e redeployar (mas o problema de limite regressa).

## Seguimento — P2028 (`Unable to start a transaction`)

Após a mudança para 6543, surgiu um segundo erro (digest **3565897406**):

```text
PrismaClientKnownRequestError: Transaction API error:
Unable to start a transaction in the given time. (P2028)
```

**Causa:** `connection_limit=1` no pooler de transação. As transações interativas
(usadas pelo RLS/auth) esperam 2s pela ligação (`maxWait` padrão do Prisma) e falham
quando outra query ocupa a única ligação da instância.

**Correção (dupla):**

1. `connection_limit=5` na `DATABASE_URL` de produção.
2. `transactionOptions: { maxWait: 10_000, timeout: 20_000 }` no `PrismaClient`
   (`src/lib/prisma.ts`).

**Reprodução e validação locais (24 transações concorrentes):**

| Configuração | Sucesso | Falhas |
|---|---|---|
| `connection_limit=1`, `maxWait` padrão | 2 | 22× P2028 |
| `connection_limit=5`, `maxWait=10s` | 24 | 0 |

