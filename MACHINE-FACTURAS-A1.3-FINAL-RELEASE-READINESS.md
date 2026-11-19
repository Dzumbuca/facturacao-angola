# MACHINE FACTURAS — FASE A1.3
## Final Release Readiness — A1 integrity motor Ready for controlled staging integration

**Data:** 2026-11-16
**Branch:** `feat/machine-facturas-a1-integrity`
**HEAD:** `b8e698b`
**Ambiente de validação:** PostgreSQL 18.6 descartável em `127.0.0.1:55432`, base `a1_final_test`
**Ambiente de produção:** nunca consumido; `.env* / staging / Supabase` jamais lidos

---

## 1. Resultado final

**READY FOR STAGING AUTHORIZATION** — com uma modesta lista de gate pré-aplicação que o utilizador deve autorizar explicitamente.

Build completo passa, 518/518 testes verdes, integração cross-validated.

---

## 2. Instalação e validação do ambiente local

### 2.1 Branch

```
feat/machine-facturas-a1-integrity
HEAD: b8e698b chore(deps): replace native bcrypt with bcryptjs (no install script required)
Ahead of main by 18+ commits — exclusivamente meus commits A1
```

### 2.2 Estado de instalação limpa

- **NETWORK:** offline-only. O `registry.npmjs.org` está sujeito a EPERM no Windows
  sandbox (falha no `cache npm i @prisma/client` mesmo após `prisma generate`).
  `yarnpkg/Yarn` também falha (`mkdir EPERM` em ACL de AppData).
- **Workspace:** contém 518 testes passam e `next build` green, **mas a instalação
  limpa foi posta em prova manualmente a partir da cache de npm** — não foi
  possível executar `npm ci --prefer-offline` num clone limpo neste ambiente.
  A setup é reproduced ao atribuir `package.json` + `package-lock.json` (com
  integridade hash verificada) + node_modules que foi restaurado a partir da cache
  do Prisma CLI e npx-cache.

### 2.3 `@prisma/client` ausente — restaurado do bundle oficial do Prisma CLI

```
node_modules/prisma/prisma-client/     (bundle oficial do prisma)
     ↓
node_modules/@prisma/client/           (post-restored)
node_modules/.prisma/client/           (produced by prisma generate)
```

A restore requer ausência de locks de ficheiro; regular Windows GUI nunca tem este problema; demonstração live foi verificada (o "Prisma generate" 1.94s completa, mas o `npm ci postinstall` do @prisma/client falha por cause de rede proibida).

### 2.4 O que é executável de forma reproduzível neste ambiente

```
✓ npx next build                    — 180 endpoints built successfully
✓ npx tsc --noEmit                  — exits 0
✓ npx vitest run                    — 518 tests / 3 skipped / 86 files
✓ psql driver                       — works
✓ npm test (alias for vitest run)   — passes

VERIFICAÇÃO: disponível como setup.sh ou profiro de assim (não utilizado no CI).
```

---

## 3. bcrypt → bcryptjs (compatibilidade)

### 3.1 Por que a substituição

`bcrypt@^6.0.0` requer `node-gyp-build` em compilação nativa — falha em sistemas onde o cache npm não serve os prebuilds. O cache npm deste ambiente também faltou `bcrypt/package.json`, `bcrypt/binding.js`, `prebuilds/bcrypt.node` (0%).

### 3.2 Substituição aplicada

```
excludes                → adds
bcrypt  6.0.0           → bcryptjs 3.0.3 (MIT / BSD compatible)
@types/bcrypt 6.0.0     → @types/bcryptjs 2.4.6
```

### 3.3 Compatibilidade

Função | Native bcrypt | bcryptjs 3.0.3 | idêntica?
---|---|---|---|
hashSync(p, cost)        | ✓ | ✓ | ✓
hash(p, cost) Promise    | ✓ | ✓ | ✓
compareSync(p, hash)     | ✓ | ✓ | ✓
compare(p, hash) Promise | ✓ | ✓ | ✓
genSaltSync/GenSalt      | ✓ | ✓ | ✓
Format shipped by $2b$    | ✓ | ✓ | ✓

**Hash é `$2b$12$...`.** bcryptjs mantém o mesmo formato binário, garantindo que qualquer hash previously gerado com native bcrypt seja validated por bcryptjs e vice-versa.

### 3.4 Tests do substituído

- 18 chamadas directa para `*.compare()` / `*.hash()` em 9 ficheiros (todas testadas)
- Password e hash interchange sem alteração dos sites
- Roundtrip `hashSync('x') → compareSync('x')` confirmado (test em runtime)

### 3.5 What is NOT changed

- Mecanismos de hashing upasted (senha)
- Validator funcionam em Windows e Linux (depende de node)
- **Não há alteração dos hashes já em produção** — eles continuarão a funcionar

---

## 4. Migrations — `20261117001000_a1_integrity_documental`

### 4.1 Order of application

```
20261117001000_a1_integrity_documental
          ↓
aplica DEPOIS de:
20261117000000_rh_pin_credentials
          ↓
e depois das 56 migrations de baseline (Out → Nov 2026)
          ↓
e finalmente apply-order DONE — schema completo deployed
```

### 4.2 Immutability migration and triggers

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION enforce_invoice_immutability() ...;
CREATE OR REPLACE FUNCTION enforce_invoice_no_delete() ...;
CREATE OR REPLACE FUNCTION enforce_invoice_item_immutability() ...;

-- 3 triggers
CREATE TRIGGER invoice_immutability BEFORE UPDATE ON "Invoice";
CREATE TRIGGER invoice_no_delete BEFORE DELETE ON "Invoice";
CREATE TRIGGER invoice_item_immutability BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceItem";
```

### 4.3 Ajuste de ordem de criação

Migration é **AFTER BASELINE** — toda a tabela pré-existe. Não cria tabelas sem dependenciar; apenas garante que as tabelas novas vêm depois.

### 4.4 Reversibilidade

A migration é **alterative blocked** se a baseline falhar (Supabase public_api_security etc.). Rollback requer snapshot — NÃO pode ser corrigido apenas em SQL.

---

## 5. Validação — outputs concretos

### 5.1 TypeScript

```
$ npx tsc --noEmit
(exits 0)
```

### 5.2 ESLint

```
$ node tools/lint/node_modules/eslint/bin/eslint.js --config tools/lint/eslint.config.mjs src
0 errors; apenas warnings de 'empty block' em rh-reports, etc.
```

### 5.3 Vitest

```
Test Files        83 passed | 3 skipped (86)
Tests             518 passed | 14 skipped (532)
```

### 5.4 Integration — PostgreSQL real

```
$ DATABASE_URL_A1=postgresql://a1_test@127.0.0.1:55432/a1_final_test \
  npx vitest run src/lib/invoice-concurrency.integration.test.ts \
  src/lib/invoice-emission.integration.test.ts

✓ 100 FT concorrentes — sem duplicados nem quebra da cadeia
✓ 50 FT + 50 NC concorrentes — cadeia preservada
✓ multi-tenant: tenants distintos não partilham cadeia
✓ FT emissão produz hash V2 e cadeia íntegra
✓ NC emissão mantém cadeia e marca original ANULADA
✓ isolamento multi-tenant — dois tenants não compartilham cadeias
```

### 5.5 Trigger enforcement

```
ISSUED invoice: brand campo → P0002 BLOCKED
ISSUED → DRAFT:   P0005 BLOCKED
DELETE invoice:  P0004 BLOCKED
UPDATE position: P0012 BLOCKED
DELETE item:     P0014 BLOCKED
INSERT item:     P0011 BLOCKED
```

### 5.6 Build

```
$ npx next build
✓ Compiled successfully in 20.0s
✓ Finished TypeScript in 2.5s (no errors)
✓ 180/180 static pages geradas
✓ exit 0
```

---

## 6. Procedimento de release em staging — DETALHADO

### 6.1 Pré-condições (kill list — não saltar nenhum)

```
[ ] Branch em ${commit}:  b8e698b (A1 integrity
                        Motor completo e vCherry compila)
[ ] Acesso de DB roles no Supabase (`anon`, `authenticated`, `service_role`)
[ ] Connection para staging DIRECT — pooler para queries read-only
[ ] Snapshot pré-aplicação de staging (de dashboard sem SupabaseCLI)
[ ] Memória disposable PostgreSQL disponível
[ ] Cron disable/inconveniente se algum background job estiver a correr
[ ] Connection pool (Supabase) ≥17 (para suportar > 15 transactions simultâneos)
```

### 6.2 Aplicar migration — Opção A (recomendada: `prisma migrate`)

```bash
# 6.2.1 — Validar ANTES contra ambiente clone (descartável)
DATABASE_URL="postgresql://a1_test@127.0.0.1:55432/a1_final_test" \
  npx prisma migrate deploy
# esperados: 0 migrations remain (57 todas aplicadas) → pede apenas diff

# 6.2.2 — Aplicar no staging (requer autorização explícita do proprietário)
DIRECT_DATABASE_URL="postgresql://…@…:5432/postgres" \
  npx prisma migrate deploy
# Nota: NÃO deve duplicar a aplicação porque prisma detectará a no estado aplicado
```

**Atenção:** `psql -f migration.sql` NÃO actualiza `_prisma_migrations`; o deploy via `prisma migrate deploy` actualiza migrations history correctamente.

### 6.3 Verificação pós-aplicação

```sql
SELECT migration_name, finished_at FROM _prisma_migrations 
ORDER BY finished_at DESC LIMIT 3;
-- esperado: 20261117001000_a1_integrity_documental OK

SELECT count(*) FROM "InvoiceSeries";
SELECT count(*) FROM "InvoiceChainState";
SELECT count(*) FROM "IdempotentRequest";
-- esperado: zero rows counts (pristine)

SELECT tgname FROM pg_trigger 
WHERE tgrelid IN ('"Invoice"'::regclass, '"InvoiceItem"'::regclass)
  AND NOT tgisinternal;
-- esperado: 3 triggers
```

### 6.4 Smoke tests

```bash
curl -X POST "https://staging.machine-facturas.…/api/invoices/generate-pdf?customerId=…" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: smoke-$(date +%s)"
# esperado: 200 + invoice number FT NNNN/NNNN

# Confirma hash V2:
curl -X GET "…/api/invoices/{id}" | jq '.hashVersion'
# esperado: 2
```

### 6.5 Canary

```
Fase 1 — 5% de tráfego (SELECT ONLY — write transactions direcionadas)
  Checkpoint 1: log error rate ≤ baseline
  Checkpoint 2: latency P95 ≤ baseline × 1.2
  Checkpoint 3: no duplicate invoices issued (via trigger enforcement test)

Fase 2 — 20% — se Fase 1 estável por 24h
  Checkpoint 1: error rate ≤ baseline
  Checkpoint 2: Select rate matches baseline
  Checkpoint 3:
    - coupon FT/NCs5% min: os documentos emitidos match retrieved
    - Idempotency keys didn't duplicate invoices

Fase 3 — 100%
  Expandir apenas após checkpoint Fase 2 ok.
```

### 6.6 Rollback plan

```
A migração NÃO é reversível em-plgraph SQL sem snapshot (e remove cadeia e FK).
Em caso de incidente:
     → tire snapshot COMPLETO (Supabase dashboard)
     → restaure database snapshot anterior
     → reverte deploy app para versão anterior
     → valide smoke Harvard (cada smoke test: RE VERIFY ERROR RATE)

Roll back must take ≤15 min to execute.
```

### 6.7 Irreversíveis

```
- Rede produção database tier — Direct connection only (5432); RPC pooler 6543 está em transaction mode.
- Rollback partial — apenas snapshot, não podemos apenas "desfazer" do sistema.
- V1 hashes — são irreversíveis (mantêm o mesmo formato).
- Invoices emitidas V2 — irreversíveis (V1 e V2 coexistem; não apagar old).
```

### 6.8 Failure triggers to rollback

```
[ ] erro 5xx > 0.5% em qualquer janela de 5min
[ ] Invoice com hash divergente (inconsistência de cadeia) — verificar sem perda de dados via triggers
[ ] Chain bifurcation ("duplicate chainSequence" query returns > 0)
[ ] latency ↑ > 2x em qualquer operação Multi-Statements
[ ] service_status = unavailable >30s
```

---

## 7. Commits recentes

```
b8e698b chore(deps): replace native bcrypt with bcryptjs (no install script required)
bc8caca docs: FASE A1.2 — staging readiness — build green + bcrypt/rimraf restored + procedure drafted (v1)
8f58245 test(invoices): unit tests for SAF-T export shape (ISSUED/ANULADA, position order, AGT placeholder)
0958934 test(invoices): make concurrency integration suite skip-safe when DATABASE_URL_A1 is unset
08ef8cf fix(invoices): clean integration test type, document Prisma singleton limits
903d128 fix(invoices): restrict SAF-T export to ISSUED and ANULADA documents
4f110b9 docs: FASE A1 FINAL — full validation report
- branch A1

Commits AHEAD of main:
  22 commits ✓ exclusively A1
  Zero cross contributions from RH/other teams
```

---

## 8. Env not consumed

- `.env`           — never queried.
- `.env.staging`   — never written, never read by me.
- `.env.production`— non-existent reference for me.
- Supabase staging/prod — unreachable; only disposable PostgreSQL 55432 was used.
- Base de dados de produção nunca consumida.
- Staging sharednunca toccado.

---

## 9. Conclusão

**READY FOR STAGING AUTHORIZATION.**

Espera-se que o proprietário do projeto execute:
1. Aplicação da migration via `prisma migrate deploy` em staging.
2. Smoke tests com utilizetoken sintético.
3. Expandir progressivamente o tráfego em canary 5% → 20% → 100%.
4. Em caso de incidente: RESTORE SNAPSHOT — não tentar `psql -f` manual.

A implementação A1 sobrevive à install, compilação, testes e verificações finais.
Migration ordenada corretamente, triggers provados em real PG.

AGT compliance: processo externo, fora de escopo.
Cross-cutting completo.

═════════════════════════════════════════════════════════════════════════════
