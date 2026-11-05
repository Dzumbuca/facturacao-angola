# RLS_NEXTAUTH_INTEGRATION_REPORT

**Status:** **PARTIALLY FIXED (minimal RLS context) / NOT E2E-VALIDATED.** Auth compatibility remains a primary RLS risk.

## Code Changes (this phase, minimal/safe)
- `src/lib/auth.ts`: added `runWithRlsContext`. Credentials `authorize` performs server-controlled email lookup in narrow admin/system context (required because User RLS policy allows self-by-id/tenant/admin, not arbitrary email lookup before session issuance). `session` callback reads current user by `app.user_id` (self policy). **PrismaAdapter remains global** (`PrismaAdapter(prisma)`); adapter tables (`Account/Session/VerificationToken/EmailActionToken`) remain RLS-off in 5437 prototype.
- `src/app/api/session/refresh/route.ts`: reads self user in explicit `app.user_id` RLS context.
- `src/app/api/onboarding/company/route.ts`: runs in authenticated user RLS context; preserves conditional tenant-link guard/idempotency.
- Auth bootstrap routes use server-controlled system context for identity operations with preserved generic responses/rate limits: `api/auth/register`, `forgot-password`, `resend-verification`, `change-unverified-email`.
- `src/lib/email-actions.ts`: narrow system context for `EmailRequestLimit` (admin-only table), `EmailDelivery` audit writes, email-action token issuance/verification/reset transactions, and token-gated marketing unsubscribe.

## 5437 Evidence
- `scripts/rls-executor-integration-test.cjs` (5/5 PASS): self user lookup by `app.user_id` works; email lookup blocked under non-admin context (confirms why credentials bootstrap needs controlled server path); `EmailRequestLimit` blocked for non-admin and readable in admin context.
- Prior DB isolation regressions preserved: 19/19 + 60/60 PASS.

## Risks / Not Proven
- **PrismaAdapter + OAuth/callbacks/linking/account/session persistence NOT E2E-validated** under RLS/NOBYPASSRLS.
- `runWithRlsContext(... isAdmin:true)` used for credentials email lookup is narrow but privileged; acceptable only as server-controlled path until auth executor/policy design is finalized. No client input can set `app.is_admin`.
- `User.tenantId` nullable (onboarding) remains a policy/bootstrap edge case.
- 5437 adapter tables RLS-off by prototype: compatibility posture, not proof that adapter is safe under enforced RLS.

## Required Validation (NOT EXECUTED)
Isolated Next.js instance against 5437 + NOBYPASSRLS role strategy: register/verify/resend/change-unverified-email, credentials login/logout/session persistence, Google OAuth/linking (if env available), forgot/reset password, onboarding for null `tenantId`, session refresh, desktop/offline grant/sessionVersion paths.

## Conclusion
**PARTIAL (code) / FAILING EVIDENCE FOR PRODUCTION READINESS.** Do not claim NextAuth compatibility under active RLS enforcement until HTTP/auth E2E passes.
