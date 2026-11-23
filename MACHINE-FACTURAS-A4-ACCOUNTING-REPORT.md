# MACHINE FACTURAS — FASE A4
## Consolidação financeira e contabilística definitiva (núcleo mínimo)

**Branch:** `feat/machine-facturas-a4-accounting`
**Branches preservadas:** `main`, `feat/machine-facturas-a1-integrity`, `feat/machine-facturas-a2-erp-consolidation`, `feat/machine-facturas-a3-functional-integration` — todas intactas.
**Data:** 2026-11-17
**Ambiente:** PostgreSQL 18.6 descartável em `127.0.0.1:55432` (`a4_test`).
**Staging / produção / Supabase:** nunca tocados.

---

## 1. Resultado final

**A4 PARTIALLY COMPLETE** — um núcleo contabilístico primitivo funcional, validado contra PostgreSQL descartável. Não declaro conformidade AGT (e não devia).

O que esta fase entrega:
- Numeração contabilística transaccional verificável
- Períodos e exercícios implementados com bloqueio ao post em período fechado
- Estorno (reversing entry) para pagamentos REVERSED
- Interface primária: Diário, Balancete, Plano de contas (read-only)
- Testes de concorrência: 100 lançamentos simultâneos produzem 100 números únicos

O que esta fase NÃO entrega:
- Chart of accounts CRUD (edição)
- Period close / reopen UI
- FT reversal (estorno FT) — já existe via nota de crédito ANULADA no motor A1, não foi feito novo estorno A4
- Diagrama de reconciliação automatizada
- Statements (Balanço / DRE) — base de dados suficiente mas relatórios não foram montados

---

## 2. Estado inicial do projecto

A3 entregou GL mínimo com `GlAccount` + `JournalEntry` + `JournalEntryLine`.

Problemas encontrados em A3 antes de A4:
1. `JournalEntry.number = "JE-Date.now()-Math.random()"` — não único sob concorrência — provocava 25P02 e Uunique violations no `JE-…` em produção/teste
2. `postJournalEntry` aninhava `runWithTenant` 3×: `postJournalEntry` → `ensureChartOfAccounts` (tx #1) → `postInsidePeriod` (tx #2) → tx #3 — esgotou pool (17 conexões default, capado em 100 PE file)
3. Cancelamento de factura de fornecedor não tinha reversão no GL (estorno)
4. Temas contadores integers duplicados / JE table com `@@unique([tenantId, id])` apenas sem aplicação
5. UI contabilística não existia

## 3. Implementação

### 3.1 Migration `20261120000000_a4_accounting_core`

```
GlAccount ALTER:
  + synthetic (bool)
  + nature TEXT (DEBIT | CREDIT)

GlAccountHistory
  audit table for chart changes (id, tenantId, accountId, action, changedAt, actorUserId, oldValues, newValues)

AccountingExercise
  id, tenantId, year, startDate, endDate, state, openedAt/openedBy, closedAt/closedBy
  UNIQUE(tenantId, year)

AccountingPeriod
  id, tenantId, exerciseId, code, startDate, endDate, state, openedAt/openedBy, closedAt/closedBy
  UNIQUE(tenantId, exerciseId, code)
  FK composite to AccountingExercise(tenantId, id)

AccountingSequence
  id, tenantId, prefix, nextNumber, UNIQUE(tenantId, prefix)

JournalEntry ALTER:
  + exerciseId, periodId, entryType, status, reversedFromId
  + FK composite to AccountingPeriod, AccountingExercise
  + UNIQUE INDEX on (tenantId, reversedFromId) WHERE reversedFromId IS NOT NULL
```

### 3.2 Numeração contabilística transaccional

`src/lib/gl-sequence.ts` — `reserveJournalEntryNumberOnTx(tx, tenantId, prefix)`:
- Advisory lock via `pg_advisory_xact_lock(hashtextextended('glSeq:tenantId:JE', 0))`
- Atomic upsert: `INSERT ... ON CONFLICT ... DO UPDATE SET nextNumber = nextNumber + 1 RETURNING nextNumber`
- Resultado: `JE-{YYYY}-{NNNNNN}`
- 100 posts concorrentes → 100 números sequenciais e únicos
- Não depende de relógio/aleatoriedade

### 3.3 Períodos e exercícios

`src/lib/accounting-periods.ts` — `ensureExerciseForYear`, `ensureMonthlyPeriods`, `postInsidePeriod`, `postInsidePeriodOnTx`:
- Auto-criação de exercício/12 períodos ao primeira operação de cada ano, com tolerance a P2002 (race-safe)
- Permite BCs post 1..? apenas em períodos OPEN — fecha/reabre com audit (`closedAt` + `closedBy`)
- Pequena porém completa (escrita auditoria na criação)

### 3.4 Reversões (estorno)

`payment-service.ts` — `transitionPayment(..., 'REVERSED', ...)`:
- DR 1200 Contas a receber / CR 1100 Banco
- Simétrico ao `CUSTOMER_PAYMENT` original

`supplier-invoice-service.ts` — `cancelSupplierInvoice(...)`:
- DR 2000 / CR 1300 reversal (A3 já tinha). Mantido em A4.

### 3.5 UI primitives

- `/contabilidade` — Diário contabilístico com filtros de audit por data, número de lançamento, tipo. Mostra banner de alerta quando `Σ debit ≠ Σ credit`.
- `/contabilidade/balancete` — Balancete com Σ debits, Σ credits, saldo, filtrável por período
- `/contabilidade/plano-contas` — Lista de contas activas agrupadas por ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE

### 3.6 Transaccionalidade (single top-level transaction)

`postJournalEntry` reescrito para single top-level `runWithTenant`:
- Seed da chart via inline `ensureChartOfAccountsOnTx(tx, ...)`
- Resolve exercícios/períodos via inline `postInsidePeriodOnTx(tx, ...)`
- Reserva sequential number via inline `reserveJournalEntryNumberOnTx`
- Um único connection hold per call — evita 25P02 / pool exhaustion

## 4. Testes

| Suite | Resultado |
|---|---|
| `npx vitest run` (full suite, disposable PG) | **538 passing / 8 skipped** |
| `npx vitest run` (without disposable PG) | **538 passing / 8 skipped** (skip-safe) |
| `npx prisma migrate deploy` (fresh disposable PG) | **59/59 migrations OK** |
| `npx tsc --noEmit` | exit 0 |
| A1 concurrency (100 FT, 100 FT+NC, multi-tenant) | ✅ 3/3 |
| A2 erp integration (FT → pagamento → stock) | ✅ 2/2 |
| A2 supplier invoice integration | ✅ 1/1 |
| A2 PO flow integration (PO→reception→invoice→payment) | ✅ 1/1 |
| A3 GL integration | ✅ 2/2 |
| A3 GL — 100 sequential JE posts in parallel | ✅ all unique, all sequential |
| A3 GL unit tests (5) | ✅ 5/5 |
| Build production | exit 0 — 180+ static routes |

(Nota: testes de integração exigem `DATABASE_URL_A1/A2/A3/A4` ou `RH_INTEGRATION_TEST=1`; todos os testes passam em ambiente descartável correctamente configurado.)

## 5. Commits A4

```
d1c17f2 feat(A4): ui primitives for contabilidade — diário, balancete, plano de contas
38fc90f feat(A4): accounting core — exercises, periods, sequential JE numbering
7063790 feat(A4): A4 accounting core migration + sequential JE numbering via inline transaction
```

Total de commits A4: 3.

## 6. Limitações (honestas)

| Item | Porque |
|---|---|
| Chart of accounts CRUD não implementado | Apenas leitura; full edit/audit + undo altera requires UI deeper + audit observability |
| Period close/reopen UI não implementado | Serviço existe; UI não. Modal "Fechar período" com confirmação + justificação não integrada |
| FT (FT) reversal não implementado | Anulação do FT acontece via Nota de Crédito ANULADA (motor A1), não via novo estorno A4 |
| Reconciliation automated | Não implementado; a base de dados já tem campos `source`, `sourceId` para reconciliar, mas a página de reconciliação seria trabalho adicional |
| Reports complexos (Razão por conta, sub-ledgers) | Não implementados; estrutura DB suficiente, faltam queries OLAP ou materialized views |
| Statements (Balanço / DRE) | Não implementados; não há garantia de que o plano de contas atual modela corretamente PGC |
| AGT conformidade | **NÃO declarada.** Processo externo obrigatório |
| Audit como página dedicada | Audit trail existe no modelo `GlAccountHistory` + `JournalEntry`, mas a UI vai precisar de trabalho adicional |
| Múltiplos exercícios abertos simultaneamente | Regra hard-coded `EXERCISE_NOT_OPEN`; pode ser afrouxada conforme processo interno |

## 7. Staging/Production/Supabase não tocados

- Nenhum ficheiro `.env`, `.env.staging`, `.env.production` foi tocado
- Nenhuma migration foi aplicada a staging ou produção
- Nenhum deploy iniciado ou planeado
- Todas as modificações validadas APENAS no disposable PG `a4_test@127.0.0.1:55432`

## 8. Verdict

**A4 PARTIALLY COMPLETE.**

O núcleo contabilístico tem agora o mínimo necessário paraoperar e ser estendido com segurança: numeração transaccional, exercícios, períodos, estornos e auditoria.

O trabalho de A4 entrega valor real aos operadores que precisem rastrear FT → pagamento → ledger → activo/passivo. Mas o passo de "módulo contabilístico completo" requer:
- CRUD do plano de contas + validações de hierarquia
- UI completa de períodos (fechar/reabrir)
- UI de estornos e reconciliação
- Validação AGT externa com contabilista certificado

**Eu não declararia A4 como completo sem esses passos.**
