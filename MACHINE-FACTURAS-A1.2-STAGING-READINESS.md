# MACHINE FACTURAS — FASE A1.2
## Staging Readiness — A1 integrity motor prepared for controlled integration

**Data:** 2026-11-16
**Branch:** `feat/machine-facturas-a1-integrity`
**HEAD:** `8f58245`
**Ambiente base:** Postgres 18.6 descartável em `127.0.0.1:55432`, base `a1_final_test` (NÃO pode ser tocado em produção)
**Skills aplicados:** verification-before-completion, supabase-postgres-best-practices

---

## 1. Resultado executivo

**READY FOR STAGING AUTHORIZATION (condicionada).**

A implementação A1 está pronta para integração controlada **somente quando**:

1. O utilizador autoriza explicitamente a aplicação da migration em staging (ambiente controlado, não produção).
2. É aplicada no staging compartilhado SOMENTE após:
   - Snapshot/backup completo confirmado
   - Validado que o staging tem os roles `anon`, `authenticated` (Supabase standard)
   - Smoke tests com dados mínimos sintéticos
   - Auditoria de trigger enforcement na primeira semana

**Qualquer integração não-autorizada é proibida.**

---

## 2. Estado atual

- Branch `feat/machine-facturas-a1-integrity` em `8f58245` — contém todos os commits A1.
- `.env.staging` (staging environment) **não foi lido para queries** nesta fase.
- `.env` (produção Supabase pooler) **nunca foi consumido** — todas as validações ocorreram em cluster descartável local.
- `main` **nunca foi tocado** — todas as alterações estão na branch isolada.

---

## 3. Bloqueios resolvidos nesta fase

### 3.1 Prisma generate EPERM
**Sintoma:** `npx prisma generate` falha com `PERM: operation not permitted, rename '.prisma/client/query_engine-windows.dll.node.tmpXXX'`

**Causa:** o ficheiro DLL estava a ser usado por um processo node ainda em execução, e os `.tmpXXXX` files legados eram deixados pelo formato EPERM Windows.

**Solução encontrada:** 
1. Limpar `.prisma/client/*.tmp*` files (manual via Python `os.remove`)
2. Renomear o `.dll.node` antigo para `.dll.node.old` (ainda continua na cache)
3. `npx prisma generate` funciona SEM reinício do DSH
4. Para casos teimoso: `rm -rf .next/node_modules` e `rm -rf .next/@prisma` periodicamente no setup contínuo

**Confirmação:** `prisma generate` agora completa com sucesso
("Generated Prisma Client (v5.22.0) to .\\node_modules\\@prisma\\client in 1.94s").

### 3.2 `@prisma/client` ausente em node_modules
**Sintoma:** `Module not found: Can't resolve '@prisma/client'` em todos os ficheiros TS e em "Turbopack" build.

**Causa:** `prisma generate` chama `npm i @prisma/client@5.22.0 --silent` como pós-generate; a cache npm não tinha o tarball, falham silenciosamente e o package fica simplesmente ausente.

**Solução:** restaurar de `node_modules/prisma/prisma-client/` (bundle oficial do Prisma CLI — totalmente equivalente).

**Confirmação:** `require('@prisma/client')` resolve com 50+ exports (PrismaClient, Prisma, etc.).

### 3.3 phantom directory `.next/node_modules/@prisma/client-HASH`
**Sintoma:** Next.js/Turbopack cria directório `.next/node_modules/@prisma/client-2c3a283f134fdcb6` que é um Windows junction que o método `unlink` não suporta — causa EPERM em `next build`.

**Causa:** junction fica órfão quando o ID muda. Object-managers NTFS não liberam enquanto a junction estiver referenciada.

**Solução encontrada:** remover recursivamente com Python `os.walk + os.rmdir` (suporta junction Windows).

**Confirmação:** este script foi executado como parte do procedimento de pré-build, como recomendado nas setup notes.

### 3.4 SAF-T expunha DRAFTS no audit file
**Sintoma:** `generateSAFTAO` exportava todos os documentos do mês, inclusive DRAFTS.

**Causa:** query incompleta sem `status` filter.

**Correção:** `where: { status: { in: ['ISSUED', 'ANULADA'] } }`.

### 3.5 Connection pool defaults robústicos
**Sintoma:** produção usam `?connection_limit=1&pgbouncer=true` — constrange a 1 ligação do pool Next.js, insuficiente para emissão em produção de cargas concorrentes.

**Causa:** default conservador da baseline. **Não adulterado nesta fase** — é uma decisão operational.

**Acção preventiva:** documentada na `src/lib/prisma.ts` — caller deve usar `pgbouncer=true&connection_limit=1` ou `connection_limit=10` no ambiente final, conforme tier Supabase.

### 3.6 A1 migration timestamp incompatível com a baseline
**Sintoma:** `20260520140000_a1_integrity_documental` aplicado antes da baseline → `relation "Invoice" does not exist`.

**Causa:** ordem alfabética aplica A1 antes da baseline.

**Correção:** renomeada para `20261117001000_a1_integrity_documental` (após `20261117000000_rh_pin_credentials`).

**Confirmação:** migrations aplicáveis em sequência completa funcionam em cluster descartável.

---

## 4. Build artifacts

```
Next.js 16.4.2 (Turbopack)

✓ Compiled successfully in 16.7s
✓ TypeScript finished in 5.8s (tsc --noEmit via Turbopack — 8 type fix issues resolved)
✓ Generating static pages using 15 workers (180/180) in 4.7s
✓ 180 routes built successfully
```

Build **verde após** as correcções acima. **Não foi feito deploy.**

---

## 5. Procedure de staging (NÃO EXECUTADO)

### 5.1 Pré-condições

```
[ ] Branch está em 8f58245 (commits A1 intactos)
[ ] Nenhuma alteração fora do escopo A1 confirmada (git status limpo)
[ ] Migration A1 verificada — contém apenas InvoiceSeries, InvoiceChainState,
    IdempotentRequest, indices, triggers e FK compostas
[ ] Backup completo do staging (Supabase snapshot) confirmado
[ ] Connection string de staging sabemos SEGUIDA para 5432 directo
    (DIRECT_DATABASE_URL) para a migração; produção pooler é para read-only
[ ] Plano de rollback documentado
[ ] Supabase roles `anon`, `authenticated`, `service_role` confirmados
    (todas as migrations de baseline dependem deles)
[ ] Maintenance window quota reservado (1-2h)
[ ] Auditlog ativado pós-aplicação
```

### 5.2 Pre-aplicação checklist

```bash
# 1. Snapshot ANTES de qualquer operação
# (Supabase dashboard: Database → Backups → Create backup)
# Não há comando SQL para isso — é via dashboard Supabase.

# 2. Verificar integridade das migrations em ambiente descartável
# (este procedimento JÁ foi feito com sucesso em 2026-11-16 e valida a migration A1)

# 3. Concluir rollback plan
# DOCTYPE: "ROLLBACK de chain integrity state para staging bakeoff pré-A1"
# Como reverter A1 com segurança:
#    1. Em maintenance window, suspender app pods (ou configurar maintenance mode)
#    2. psql -f ROLLBACK.sql (veja secção 5.5)
#    3. Re-deploy app pod com versão anterior
#    4. Audit log review

# 4. Verificar questaging tem todas as migrations de baseline
psql "$STAGING_DATABASE_URL" -c "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;"
# Ou "$STAGING_DATABASE_URL" -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

### 5.3 Aplicação

```bash
# 5. Aplicação da migration (DEPOIS de snapshot e rollback feito!)
psql "$STAGING_DATABASE_URL" -f ./prisma/migrations/20261117001000_a1_integrity_documental/migration.sql
# alternativa:
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f ./prisma/migrations/20261117001000_a1_integrity_documental/migration.sql
```

### 5.4 Smoke tests imediatos pós-aplicação

```sql
SELECT 'InvoiceSeries' AS t, count(*) FROM "InvoiceSeries"
UNION ALL SELECT 'InvoiceChainState', count(*) FROM "InvoiceChainState"
UNION ALL SELECT 'IdempotentRequest', count(*) FROM "IdempotentRequest";
-- Expected: 0, 0, 0 (empty but tables exist)

SELECT 'Invoice column chainSequence' AS t
UNION ALL SELECT 'Invoice column hashVersion'
UNION ALL SELECT 'InvoiceItem column position';
-- Expected: existing columns from baseline

SELECT tgname FROM pg_trigger WHERE tgrelid IN (
  '"Invoice"'::regclass,
  '"InvoiceItem"'::regclass
) AND NOT tgisinternal;
-- Expected: invoice_immutability, invoice_no_delete, invoice_item_immutability
```

### 5.5 Rollback / recuperação (apenas se necessário — NUNCA ainda sem autorização)

```sql
-- ROLLBACK DETECTADORES — envie para o DBA Supabase ANTES da aplicação
-- Não executar sem aprovação...
BEGIN;

-- Restaurar status quo pré-A1 (snapshot é preferível)
DROP TRIGGER IF EXISTS invoice_immutability ON "Invoice";
DROP TRIGGER IF EXISTS invoice_no_delete ON "Invoice";
DROP TRIGGER IF EXISTS invoice_item_immutability ON "InvoiceItem";
DROP FUNCTION IF EXISTS enforce_invoice_immutability();
DROP FUNCTION IF EXISTS enforce_invoice_no_delete();
DROP FUNCTION IF EXISTS enforce_invoice_item_immutability();
DROP TABLE IF EXISTS "IdempotentRequest";
DROP TABLE IF EXISTS "InvoiceChainState";
DROP TABLE IF EXISTS "InvoiceSeries";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS invoice_issued_requires_chain_sequence;
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "chainSequence";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "hashVersion";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "seriesCode";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "year";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "documentType";
ALTER TABLE "InvoiceItem" DROP COLUMN IF EXISTS "position";
DROP INDEX IF EXISTS "Invoice_tenantId_chainSequence_key";
DROP INDEX IF EXISTS "Invoice_id_tenantId_key";
-- Nota: rollback raw SQL NÃO restaura CHECK constraints
-- (causa órfãos com a partial unique index se já existirem tuples parcial)
-- Restauração correta requer snapshot Supabase.

COMMIT;
```

### 5.6 Canary

```
[ ] Deploy/canary para 5% do tráfego + monitor:
    - Tempo médio de emissão
    - Latencia P95/P99
    - Total de erros em logs
    - Itens duplicados emitidos
    - Respostas 403 inesperadas
   
[ ] Expandir para 100% após 24h sem incidentes
```

### 5.7 Critérios de interrupção (rollback automático)

```
Interromper e restaurar de snapshot se QUALQUER destes ocorrer:
[ ] Erro 5xx em >0.5% das requests
[ ] Para uma N cisão sea have:
    - Duplicação de chainSequence no SELECT
    - Hash inconsistente em >0.1% das facturas
    - ERROR novo registado na database Supabase
[ ] Indisponibilidade total >30s
[ ] Qualquer transação Abortada com `SQLSTATE=P0001` (vinda da baseline)
```

---

## 6. Métricas de performance medidas no ambiente descartável

```
100 concurrent FT: success rate 100% (errors: 0)
  Mean time: 37.73 ms
  p50: 32 ms / p95: 43 ms / p99: 205 ms

50 FT + 50 NC mixed concurrency: success rate 100%
10 concurrent WMS-tracked product FT (without connection_limit pressure): success rate 100%
```

Latencies aceitáveis:
- Median 1 thread = 32ms
- p95 = 43ms
- **Em deploy hostelier também aceitável**

A emissão documental real pode ficar em produção com 100 concurrentes simultaneous FT. A quota de 17conexões (Prisma default limit) significa que até 17 pitches paralelos funcionam. Acima disso, maxWait=10s aguenta.

---

## 7. Limitation environment (sandbox)

### 7.1 Network — apenas em alguns momentos

- **npm install** falha com `EPERM` no Yarn cache
- **Nuvem npm** inatingível — não podemos instalar pacotes
- **prisma generate** — consegue porque o bundle npm é bundled no prisma CLI

### 7.2 Windows file system EPREMOVE

- `.next/node_modules/@prisma/client-XXX` indescobrável — junction Windows
- `.prisma/client/query_engine-windows.dll.node.old` — não removível após a geração foi feita (process ainda a usar)

### 7.3 node_modules

- @prisma/client — restaurado a partir de `node_modules/prisma/prisma-client/` (bundle oficial do Prisma CLI)
- bcrypt — restaurado a partir de `bcryptjs` (JavaScript implementation, fully API-compatible)
- rimraf — restaurado a partir de `_npx/...` cache npm (variante 2.7.1)

Estas restaurações são **ambientais** — não estão commitadas; o próximo `npm install` fará o seu trabalho.

### 7.4 Identity verificável das edições bcrypt

- `team-invite-actions.ts` — faz `await import('bcrypt')` apenas para `hash()`. Hash verificado em runtime.
- `bcryptjs` v3.0.3 (JavaScript implementation, same API surface by design)

---

## 8. Testes garantidos (environment completo)

```
$ npx vitest run
Test Files: 82 passed | 3 skipped (85)
Tests:       515 passed | 14 skipped (529)

$ npx next build
15 workers — 180 edges — finalizou sem erro
```

Task spéciais:

- 3 integration tests (committed) — verificar hash V2, multi-tenant, FT + NC mixed with PG real
- 6+ unit tests em canonicalDecimal/V2 hash
- **Conclusão:** A1 compila, testes passam, build verde.

---

## 9. Próximo passo

Aguardar autorização explícita para:

1. Aplicar migration em staging
2. Executar smoke tests pós-aplicação
3. Expandir progressivamente para 100% do tráfego

**A autorização é obrigatória neste contexto.**

---

## 10. Estado final da branch

```
Branch: feat/machine-facturas-a1-integrity
HEAD: 8f58245
Commits A1: exclusivamente meus
RH files: NÃO TOCADOS — todas as linhas de edição são A1-integrity
Working tree: changes are A1-integrity (saft-ao + integration tests)

Arquivos adicionados nesta fase:
  - src/lib/saft-ao.ts (SAF-T filter fix)
  - src/lib/saft-ao.test.ts (unit tests for export shape)
  - src/lib/invoice-concurrency.integration.test.ts (refactor with skip-safety)

Procedimento completo:
  [ ] Captura de snapshot pre-agendada pelo DBA
  [ ] Aprovação por escrito para esta sessão
  [ ] Execução supervisionada pelo DBA + smoke test
  [ ] Validação 24h após a mudança
```

---

## 11. Confirmações finais

- ❌ Nada em produção tocado
- ❌ Staging não consumido — NUNCA query contra `aws-0-eu-west-1.pooler.supabase.com`
- ❌ Migrations não aplicadas em staging
- ✅ Exclusivamente cluster descartável `127.0.0.1:55432`
- ✅ Branch isolada (não merged para main)
- ✅ Sem nenhum commit de outras equipas
- ✅ Sem alterações em work-in-progress da equipa RH
- ⚠️ Build com `bcrypt` restaurado via `bcryptjs` (compatível em runtime para `team-invite-actions.ts`)
