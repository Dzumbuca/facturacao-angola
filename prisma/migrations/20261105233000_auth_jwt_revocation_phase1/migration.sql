-- Phase 1: JWT revocation persistence (A+/E-lite). ADDITIVE ONLY. STAGING 5437 ONLY.
-- NOT APPLIED: mf_rls_staging has no public._prisma_migrations table while Prisma reports 24 unapplied migrations (history divergence). Manual apply only after explicit authorization and reconciliation.

CREATE TABLE "AuthJwtRevocation" (
  "id" TEXT NOT NULL,
  "jtiHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantIdAtIssue" TEXT,
  "reason" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "actorUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthJwtRevocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthJwtRevocation_jtiHash_key" UNIQUE ("jtiHash"),
  CONSTRAINT "AuthJwtRevocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuthJwtRevocation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AuthJwtRevocation_userId_revokedAt_idx" ON "AuthJwtRevocation"("userId", "revokedAt");
CREATE INDEX "AuthJwtRevocation_expiresAt_idx" ON "AuthJwtRevocation"("expiresAt");
CREATE INDEX "AuthJwtRevocation_userId_expiresAt_idx" ON "AuthJwtRevocation"("userId", "expiresAt");

-- RLS: deny by default. Policies assume tx-local GUCs set by tenant-db executors:
-- app.user_id = authenticated user id; app.is_admin = 'true' for explicit platform/admin executor only.
ALTER TABLE "AuthJwtRevocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthJwtRevocation" FORCE ROW LEVEL SECURITY;

-- Admin executor (explicit server-controlled): full access for platform/admin flows and audited global revocation.
CREATE POLICY "ajr_admin_all" ON "AuthJwtRevocation"
  FOR ALL
  USING (current_setting('app.is_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_admin', true) = 'true');

-- Authenticated self: may read own revocation rows (future session introspection) only when bound to app.user_id.
CREATE POLICY "ajr_self_select" ON "AuthJwtRevocation"
  FOR SELECT
  USING ("userId" = NULLIF(current_setting('app.user_id', true), ''));

-- Authenticated self: may insert own revocation only (per-device logout/revoke own session) when jti owner binding is enforced by app code.
CREATE POLICY "ajr_self_insert" ON "AuthJwtRevocation"
  FOR INSERT
  WITH CHECK ("userId" = NULLIF(current_setting('app.user_id', true), ''));

-- No self UPDATE/DELETE: revocation records are append-only evidence except admin/system cleanup via admin executor.

-- Privileges: revoke broad PUBLIC; grant minimal table privileges to runtime roles that need access through RLS.
REVOKE ALL ON TABLE "AuthJwtRevocation" FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE "AuthJwtRevocation" TO mf_app_nobypass;
GRANT SELECT, INSERT ON TABLE "AuthJwtRevocation" TO mf_admin_executor;
GRANT SELECT, INSERT, DELETE ON TABLE "AuthJwtRevocation" TO mf_migration; -- staging maintenance/cleanup only when explicitly authorized

-- NOTE: tenantIdAtIssue is metadata only, never authorization source. No cross-tenant policy via tenantId.
-- NOTE: future integration must call centralized validator before runAsSystem/runAsAdmin user-session paths.
