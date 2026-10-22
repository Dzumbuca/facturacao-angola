# Machine Facturas Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, audited, multi-tenant platform administration area to the existing Machine Facturas app.

**Architecture:** Keep the current NextAuth/Prisma architecture and add separate platform and tenant roles, account states, a database-backed platform configuration, and append-only admin audit events. Use database-revalidated server guards for every admin page/action and normal tenant API request; render admin lists as server components with validated server-side search and pagination.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, NextAuth 5 beta, Prisma 5, PostgreSQL, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-machine-facturas-admin-design.md`

## Global Constraints

- Platform authorization must be checked on the server for every admin page and operation.
- Existing users receive no platform administrator privileges from migration or registration defaults.
- Administrative operations never edit or delete issued fiscal documents.
- Company suspension blocks writes but preserves reads and exports of existing documents.
- Never return password hashes, tokens, secrets, full bank account numbers, or unnecessary personal data.
- Dashboard metrics come from real database records; platform revenue is not reported.
- Mutations that change account state or roles write an audit event in the same transaction.
- Keep each file under 500 lines; do not commit `.env` or credentials.

## Review Focus

- An existing JWT remains after role revocation or user/tenant suspension — test that protected pages and API requests re-read current database state.
- Two concurrent requests try to disable the last platform administrator — test transaction-safe prevention.
- A suspended company requests reads/exports and writes — test reads succeed and writes fail without changing records.
- Malformed, oversized, repeated, or unsupported query values reach list pages — test bounded validation and safe defaults.
- A crafted action changes a user's global role or crosses tenant boundaries — test role allow-lists, actor checks, and scoped lookups.

---

### Task 1: Add explicit roles, statuses, platform settings, and audit schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_platform_admin/migration.sql`
- Modify: `src/app/api/auth/register/route.ts`
- Test: `src/lib/admin-schema.test.ts`

**Interfaces:**
- `User.platformRole`: enum `NONE | ADMIN`, default `NONE`.
- `User.tenantRole`: enum `USER | COMPANY_ADMIN | BILLING | VIEWER`, default `USER`.
- `User.status`: enum `ACTIVE | SUSPENDED`, default `ACTIVE`.
- `Tenant.status`: enum `ACTIVE | SUSPENDED`, default `ACTIVE`; nullable suspension reason/time.
- `PlatformConfig`: singleton row with `platformName`, optional `supportEmail`, optional `supportPhone`, `updatedAt`, and `updatedByUserId`.
- `AdminAuditLog`: optional actor ID/type, action, resource type/ID, reason, result, minimal JSON metadata, timestamp; no update/delete route.

- [ ] **Step 1: Add migration contract tests** asserting defaults never promote existing users, existing `tenantId` values remain, and status defaults preserve existing access.
- [ ] **Step 2: Run the focused contract test** and confirm it fails before implementation.
- [ ] **Step 3: Add the Prisma enums/models/relations and additive SQL migration.** Make `User.tenantId` nullable for platform-only accounts; preserve every existing FK and row. Create a default platform config named `Machine Facturas` without support contact values. Do not seed any admin role.
- [ ] **Step 4: Update registration** to create tenant and user in one transaction and assign only the new account's tenant role `COMPANY_ADMIN`; keep platform role `NONE`.
- [ ] **Step 5: Run Prisma validation and the focused test.** Confirm existing rows require no backfill to a privileged role and the generated migration contains no table reset/drop.

### Task 2: Enforce current account and role state on the server

**Files:**
- Modify: `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/route-access.ts`, `src/app/(dashboard)/layout.tsx`
- Create: `src/lib/admin-auth.ts`, `src/lib/admin-auth.test.ts`
- Create: `scripts/bootstrap-platform-admin.ts`
- Modify: `package.json`

**Interfaces:**
- `requirePlatformAdmin(): Promise<{ id: string; name: string | null; email: string | null }>` reads `auth()` and the current `User` from Prisma; throws a generic authorization error otherwise.
- `getTenantAccess(): Promise<{ userId: string; tenantId: string; tenantRole: TenantRole; tenantStatus: AccountStatus }>` rejects missing/suspended users but returns an active user's suspended tenant in read-only mode.
- `assertTenantWriteAllowed(operation?: 'billing' | 'company_settings'): Promise<TenantAccess>` additionally enforces an active tenant, blocks `VIEWER` writes, and reserves company settings for `COMPANY_ADMIN`.

- [ ] **Step 1: Add failing tests** for anonymous, regular, company-admin, platform-admin, stale JWT after role revocation, suspended user, and suspended tenant behavior.
- [ ] **Step 2: Run the focused tests** and confirm the new guards are missing or reject expected fixtures.
- [ ] **Step 3: Extend NextAuth callbacks/types** to retain stable user ID and nullable tenant ID; deny suspended credentials at login. Add async page authorization for protected dashboard and `/admin` paths while retaining explicit layout/action checks.
- [ ] **Step 4: Implement the server-only guard helpers** using database reads on every call; keep authorization responses generic and avoid exposing raw Prisma failures.
- [ ] **Step 5: Implement the one-time bootstrap command** requiring an exact existing user ID and interactive confirmation phrase `PROMOVER <id>`. It fails if that user is absent/suspended or any platform admin already exists, preserves tenant membership/role, promotes in a transaction, and writes a bootstrap audit event. Add `admin:bootstrap` script entry.
- [ ] **Step 6: Run auth/session/route-access tests** and bootstrap helper tests; verify no email/name auto-promotion path exists.

### Task 3: Apply suspended-account policy to existing tenant operations

**Files:**
- Modify all handlers under `src/app/api/` that read or mutate tenant data, including company profile/bank accounts, customers, invoices/drafts, PDFs, SAF-T, payments, products, and report export.
- Modify: `src/app/(dashboard)/layout.tsx`, `src/lib/route-access.ts`
- Test: `src/lib/tenant-access.test.ts` and relevant existing route tests

**Interfaces:**
- Read/export handlers for existing records use `getTenantAccess()`; suspended tenants remain readable/exportable to active users. The `generate-pdf` route issues a new invoice, so it is a write operation.
- Every mutation uses `assertTenantWriteAllowed()`; suspended tenants/users receive a generic `403` and no write occurs.
- No tenant route accepts `tenantId` from a request as authority; use the authenticated access result.

- [ ] **Step 1: Add failing tests** for read/export allowed and write denied on suspended tenants, suspended user denied, and active tenant write allowed.
- [ ] **Step 2: Run the focused route tests** and confirm they expose unguarded access paths.
- [ ] **Step 3: Update every tenant API handler** to obtain current actor/tenant state server-side, distinguish reads from writes, and preserve existing company scoping.
- [ ] **Step 4: Ensure protected dashboard layout revalidates user state** and provides a read-only suspension notice if the account is active but its tenant is suspended; suspended user is redirected to sign-in.
- [ ] **Step 5: Run all existing API/auth tests plus tenant-access tests.** Inspect each API handler for a per-request state check and confirm invoice/payment fields are never touched by suspension.

### Task 4: Add audited administrative queries and mutations

**Files:**
- Create: `src/lib/admin-data.ts`, `src/lib/admin-data.test.ts`
- Create: `src/lib/admin-actions.ts`, `src/lib/admin-actions.test.ts`
- Create: `src/lib/admin-validation.ts`, `src/lib/admin-validation.test.ts`

**Interfaces:**
- `listAdminTenants(query)`, `listAdminUsers(query)`, `listAdminInvoices(query)`, `listAdminAuditLogs(query)` accept validated search/filter/sort/page and return only display fields plus total count.
- `getAdminDashboard(period)` returns actual company/user/document counts, invoiced totals, confirmed receipts, outstanding balances, daily trend buckets, and recent records.
- Server actions `setTenantStatus`, `setUserStatus`, `setTenantRole`, `setPlatformRole`, `updatePlatformConfig` all call `requirePlatformAdmin()` and return generic success/error state.

- [ ] **Step 1: Write failing tests** for query parsing bounds/sort allow-lists, tenant/user/document scoping, metric separation, safe projections, audit creation, invalid status/role, self-elevation denial, last-admin protection including suspension, and transaction rollback if audit insert fails.
- [ ] **Step 2: Run focused tests** to verify the missing service/actions are detected.
- [ ] **Step 3: Implement validation and read queries** with explicit `select`, server-side `where`, stable ordering, page size capped at 100, and real aggregation/grouping.
- [ ] **Step 4: Implement mutations** with server actor check, reason validation, transactionally written state plus `AdminAuditLog`; block any action that would leave zero active platform admins. Only `COMPANY_ADMIN`, `BILLING`, or `VIEWER` are assignable tenant roles; `platformRole` changes require a distinct admin action and cannot be supplied through a generic user edit payload.
- [ ] **Step 5: Implement platform settings mutation** with allow-listed nonsecret fields and audit; no fiscal parameters or credential fields.
- [ ] **Step 6: Run focused tests** and inspect serialized results to ensure hashes/secrets and sensitive fields are absent.

### Task 5: Build the isolated responsive admin shell and real dashboard

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/components/admin-shell.tsx`
- Create: `src/components/admin-trend-chart.tsx`, `src/components/admin-pagination.tsx`
- Test: `src/lib/admin-route-access.test.ts`

**Interfaces:**
- Admin layout calls `requirePlatformAdmin()` and passes minimal operator identity to `AdminShell`.
- `AdminShell` renders own scrollable sidebar, contextual header, user identity, links to each admin section, responsive mobile navigation, and configured platform name.
- Dashboard uses `getAdminDashboard()` and labels billed amount, confirmed receipts, and balance separately.

- [ ] **Step 1: Add failing route/render tests** for unauthenticated/tenant-only denial, correct nav links, and clear empty state for zero records.
- [ ] **Step 2: Run focused tests** and confirm admin route is absent/unprotected as expected.
- [ ] **Step 3: Implement the shell and dashboard** using the project palette (`#021F87`, charcoal, white/soft grey, green, amber, red), pt-AO dates, AOA/Kz, trends only from database buckets, and no invented counts/revenue.
- [ ] **Step 4: Run focused tests** and review responsive semantics, keyboard focus, independent sidebar scrolling, and empty/loading/error states.

### Task 6: Implement company, user, document, audit, system, and settings pages

**Files:**
- Create: `src/app/admin/empresas/page.tsx`, `src/app/admin/empresas/[id]/page.tsx`
- Create: `src/app/admin/utilizadores/page.tsx`, `src/app/admin/utilizadores/[id]/page.tsx`
- Create: `src/app/admin/documentos/page.tsx`, `src/app/admin/auditoria/page.tsx`
- Create: `src/app/admin/sistema/page.tsx`, `src/app/admin/configuracoes/page.tsx`
- Create: `src/components/admin-status-form.tsx`, `src/components/admin-search-filters.tsx`

- [ ] **Step 1: Add tests** for company/user/document/audit list query filters and page rendering, including missing resource, empty result, and an unauthorized action submission.
- [ ] **Step 2: Implement server-rendered tables** with search, combinable status/role filters, allow-listed ordering, pagination, explicit empty/error states, and details that include only necessary fields and operational counts.
- [ ] **Step 3: Implement critical-operation forms** with required reason and a confirmation prompt; all submissions call guarded server actions; show success/failure feedback.
- [ ] **Step 4: Implement system page checks**: execute `SELECT 1` to verify database reachability; report app version only if available and label `process.uptime()` as current process uptime; indicate error telemetry/storage/external integrations are unavailable when no implementation exists; never return stack traces.
- [ ] **Step 5: Implement settings page** for actual stored platform name and optional support contacts; display configured values in admin shell. Do not expose or accept secret/fiscal parameters.
- [ ] **Step 6: Run relevant page/service tests** and verify no admin list response includes passwords, tokens, invoice line data, or full bank account numbers.

### Task 7: Full security, regression, and production verification

**Files:**
- Modify any source/test files exposed by verification.
- Test: all relevant existing `src/lib/*.test.ts` plus new admin/auth/tenant-access suites.

- [ ] **Step 1: Run the complete Vitest suite** with `npm test` and record the exact result.
- [ ] **Step 2: Run production build** with `npm run build` and record any environment-dependent limitation.
- [ ] **Step 3: Review all admin pages and actions** for server-side guard calls, transaction/audit coverage, query bounds, and safe error projection.
- [ ] **Step 4: Review all existing tenant APIs** for authenticated tenant scoping and current status validation; test cross-tenant IDs and stale sessions.
- [ ] **Step 5: If a browser is available, verify desktop/tablet/mobile layout and keyboard navigation; otherwise report this check as not performed.**
- [ ] **Step 6: Report architecture, created routes, migration, security controls, exact tests/build, and features still limited by missing telemetry or recovery flow.**
