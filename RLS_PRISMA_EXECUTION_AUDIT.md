# RLS_PRISMA_EXECUTION_AUDIT.md
**Scope:** static+heuristic audit of `src/**/*.{ts,tsx}` for Prisma/RLS/auth context signals. **5437 runtime not modified.** Classification is conservative; route/service behavior may differ from heuristic.

## Inputs
- Raw scan: `tmp/rls-e2e-artifacts/prisma-execution-audit-raw.json` (129 files with Prisma/context/auth signals).
- Classified: `tmp/rls-e2e-artifacts/prisma-execution-audit.json` — counts `{SAFE:70, NEEDS CONTEXT:25, RISK:25, SYSTEM ONLY:2, ADMIN ONLY:7}`.
- Interesting subset: `tmp/rls-e2e-artifacts/prisma-audit-interesting.json`.

## Classification legend
- **SAFE**: has explicit RLS executor/context and/or appropriate auth/tenant guard pattern detected.
- **NEEDS CONTEXT**: Prisma/auth usage detected without clear executor signal in the same heuristic path; requires targeted review (many are pages/components or shared helpers).
- **RISK**: Prisma usage without detected tenant/RLS context/auth guard signal.
- **ADMIN ONLY**: admin/platform path with auth/context signals; must be server-authorized and not client-tenant-controlled.
- **SYSTEM ONLY**: system/infra path (prisma client, tenant-db, cron) with controlled execution expectations.
- **NOT VALIDATED**: no strong signal; manual review needed.

## Critical findings (this phase)
| File | Class | Finding | Action |
|---|---|---|---|
| `src/lib/admin-auth.ts` | **FIXED/PASS (runtime evidence)** | Used global Prisma `include tenant` for authz; under `User/Tenant` RLS with no tenant context, tenant status read failed and caused `/api/produtos` 403 via tenant access checks. | Fixed: self user read in `runWithRlsContext(userId)`, tenant status read in `runWithRlsContext(userId,tenantId)`; server-controlled, no cross-tenant data. Validated by HTTP A/B probe (`/api/produtos` 200 own-only after fix) and `tsc`. |
| `src/lib/auth.ts` | **AT RISK / PARTIAL** | `PrismaAdapter(prisma)` global. Credentials/session callbacks use explicit RLS context; adapter operations not proven under enforced RLS. Adapter tables RLS OFF prototype on 5437. | Keep server-controlled contexts; validate adapter flows under target RLS/pooling before production. |
| `src/lib/prisma.ts` | **SYSTEM ONLY** | Global Prisma client singleton used by adapter and legacy paths. | Acceptable only where wrapped by executors/guards; avoid direct use in tenant routes. |
| `src/app/api/cron/reminders/route.ts` | **SYSTEM ONLY / PARTIAL** | `CRON_SECRET` + `runAsSystem` present (per audit/previous evidence). | Runtime HTTP beyond secret-missing probe: NOT EXECUTED. |
| `src/app/api/plan/payment/proof/[id]/route.ts` | **ADMIN ONLY / PARTIAL** | Server session + DB `platformRole` check + `runAsAdmin` (code). | Full admin role HTTP matrix: NOT EXECUTED. |
| `src/lib/invoice-share.ts` | **NEEDS CONTEXT** | Heuristic flagged. | Review share-token semantics; ensure no tenant bypass. NOT VALIDATED. |
| `src/lib/register-machine-stock.ts` | **RISK** | Prisma/global usage signal without clear context in heuristic. | Review and wrap if tenant-scoped. NOT VALIDATED. |
| `src/app/admin/*` pages/actions (`emails`, `equipa`, layout) | **NEEDS CONTEXT** | Heuristic; server actions/pages may use admin guards/services. | Validate with admin HTTP matrix. |
| Dashboard pages (`customers/invoices/reports/stock/warehouses/documentos`) | **NEEDS CONTEXT** | Server component Prisma patterns vary; may call services with context. | Targeted review + E2E as needed. |
| Public/marketing/guide pages | **RISK (low relevance)** | Heuristic risk due to Prisma patterns in mixed codebase scan; many likely non-tenant/public or static. | Exclude from tenant-data RLS unless they query tenant data. NOT VALIDATED. |

## Route-level RLS context snapshot (API, heuristic)
- `tmp/rls-route-audit-v2.csv` generated; almost all Prisma-signal API routes show tenant context and/or auth guard signals. `stock/movements/[id]` showed `Prisma=true,TenantCtx=true,Auth=true`. No route with `Auth=False && Prisma=True` found by the heuristic query; verify manually for edge routes.
- Routes with `TenantCtx` signal include key tenant paths: products, customers, stock, warehouses, invoices drafts/payments/pdf/email, business documents pdf, company profile/bank accounts, onboarding, session refresh, cron, plan payment proof.

## Not validated / remaining
- Full call-path proof for every `NEEDS CONTEXT`/`RISK` item.
- PrismaAdapter internal adapter calls under active RLS (global client).
- Server actions outside scanned route patterns where relevant.
- Client-supplied `tenantId` misuse: targeted checks found no evidence in tested routes; exhaustive grep/review **NOT EXECUTED**.

**Conclusion:** Audit is **PARTIAL**. One real RLS-context defect fixed and validated; adapter/global Prisma and many heuristic items remain **AT RISK/NOT VALIDATED**.
