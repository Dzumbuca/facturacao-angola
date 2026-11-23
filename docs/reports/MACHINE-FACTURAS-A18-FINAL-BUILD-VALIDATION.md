# A18/A1 Idempotency Fix — Final Build Validation Report

**Branch**: `fix/a18-a1-integrity-and-concurrency`  
**HEAD**: `8746043d7720a20368da2d174b60158b007d820b`  
**Date**: 2026-11-23  
**Environment**: Clean install validated in isolated worktree, PostgreSQL 5432 (trust auth), test DB `a1_validation_test`

---

## Summary

All validation checks **PASS**:

| Check | Status | Details |
|-------|--------|---------|
| A18/A1 Regression Tests (7) | ✅ PASS | 3 concurrency + 3 emission + 1 multi-tenant |
| Distributed Idempotency Tests (7) | ✅ PASS | Race regression, replay, 100 concurrent, conflict, multi-tenant, recovery |
| TypeScript (`tsc --noEmit`) | ✅ PASS | 0 errors |
| ESLint (tools/lint config) | ✅ PASS | 0 errors, 16 pre-existing warnings |
| Prisma Validate/Generate | ✅ PASS | Schema valid, client generated |
| Production `next build` (Turbopack) | ✅ PASS | Exit code 0, 198 pages generated |

---

## A18/A1 Regression Tests (7/7 PASS)

| Test | Duration | Result |
|------|----------|--------|
| 100 FT concorrentes — sem duplicados nem quebra da cadeia | 4.4s | ✅ PASS |
| 50 FT + 50 NC concorrentes — cadeia preservada | 44ms | ✅ PASS |
| multi-tenant: tenants distintos não partilham cadeia | 47ms | ✅ PASS |
| FT emissão produz hash V2 e cadeia íntegra | 187ms | ✅ PASS |
| NC emissão mantém cadeia e marca original ANULADA | 32ms | ✅ PASS |
| isolamento multi-tenant — dois tenants não compartilham cadeias | 28ms | ✅ PASS |
| A8 — same tenant 100 FTs parallel (advisory lock removed, row-lock chain) | 2.1s | ✅ PASS |

---

## Distributed Idempotency Tests (7/7 PASS)

| Test | Description | Result |
|------|-------------|--------|
| 1 | Race Condition Regression | ✅ PASS |
| 2 | Replay Sequential | ✅ PASS |
| 3 | 100 Same-Key Concurrent | ✅ PASS |
| 4 | Same Key Diff Payload Conflict | ✅ PASS |
| 5 | Different Keys 100 Emissions | ✅ PASS |
| 6 | Multi-tenant Same Key | ✅ PASS |
| 7 | Process Failure Recovery | ✅ PASS |

---

## SQL Integrity Verification (All Tests)

- **Zero duplicate chain sequences** (`dupSeq = 0`)
- **Zero duplicate chain hashes** (`dupHash = 0`)  
- **Zero duplicate invoice numbers** (`dupNum = 0`)
- **Chain states consistent** (`chainConsistent = true`)
- **All 709 emission leases RELEASED** (`activeLeases = 0`)

---

## Idempotency Fix Implementation

**File**: `src/lib/invoice-integrity.ts`

```typescript
export async function acquireIdempotencyLock(
  tx: Prisma.TransactionClient,
  tenantId: string,
  idempotencyKey: string
) {
  const tenantHash = hashtext(tenantId);
  const keyHash = hashtext(idempotencyKey);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${tenantHash}, ${keyHash})`;
}
```

**Called in**:
- `src/lib/invoice-service.ts:161` — `issueInvoiceOnce`
- `src/lib/invoice-service.ts:479` — `issueCreditNoteOnce`

**Key properties**:
- Per-transaction advisory lock (`pg_advisory_xact_lock`) — auto-released on commit/rollback
- Composite key: `(tenantId, idempotencyKey)` matches `IdempotentRequest@@id([tenantId, key])`
- No deadlocks: lock ordering by `(tenantHash, keyHash)` is deterministic
- Works across distributed processes (2 independent Node processes validated)

---

## Clean Install Reproducibility (Validated)

Isolated worktree test (`C:\Users\ADMINI~1\AppData\Local\Temp\kilo\acceptance-validation`):

| Step | Result |
|------|--------|
| `npm ci` | ✅ PASS |
| Next.js types present | ✅ PASS |
| Next.js runtime present | ✅ PASS |
| Functional checks | ✅ PASS |
| All 7 regression tests | ✅ PASS |
| All 7 distributed tests | ✅ PASS |
| `tsc --noEmit` | ✅ PASS |
| ESLint (tools/lint) | ✅ PASS |
| Prisma validate/generate | ✅ PASS |
| `next build` (Turbopack) | ✅ PASS |

---

## Key Versions Pinned

| Package | Version |
|---------|---------|
| `bcryptjs` | `3.0.2` |
| `next` | `16.4.6` |
| `typescript` | `6.0.3` |
| `@typescript-eslint/parser` | `8.73.0` |

---

## Files Modified (9 uncommitted files preserved)

- `src/lib/invoice-integrity.ts` — `acquireIdempotencyLock` added
- `src/lib/invoice-service.ts` — calls to `acquireIdempotencyLock` in `issueInvoiceOnce` and `issueCreditNoteOnce`
- `src/lib/next-shims.d.ts` — TypeScript shims for Next.js 16 subpaths
- `scripts/distributed-worker.ts` / `.cjs` — distributed test worker
- `scripts/distributed-coordinator.cjs` — launches 2 independent Node processes
- `src/app/(dashboard)/contabilidade/balancete/page.tsx` — removed unused `Link` import
- `src/app/(dashboard)/contabilidade/exercicios/page.tsx` — removed unused `Link` import
- `src/app/(dashboard)/contabilidade/razao/page.tsx` — removed unused `Link` import
- `src/app/(dashboard)/contabilidade/statements/page.tsx` — removed unused `Link` import
- `src/app/(dashboard)/contabilidade/reconciliar/page.tsx` — removed unused imports, added `listRecentReconciliations`
- `src/app/(dashboard)/contabilidade/periodos/period-actions-client.tsx` — fixed `useState` imports
- `src/app/(dashboard)/pagar/page.tsx` — removed unused `stateStyles`

---

## Conclusion

The A18/A1 idempotency fix is **production-ready**. All regression tests, distributed idempotency tests, type checks, lint checks, and production build pass in a clean, reproducible environment.