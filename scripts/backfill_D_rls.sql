-- Backfill Script D (PREPARED, NOT EXECUTED) — RLS policies for 7 tables
-- Each policy justified individually. Review before applying.

-- 1. BusinessDocument (tenant-scoped, tenantId NOT NULL)
ALTER TABLE "BusinessDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessDocument" FORCE ROW LEVEL SECURITY;
CREATE POLICY "bd_tenant_isolation" ON "BusinessDocument"
  FOR ALL
  USING (current_setting('app.tenant_id', true) = "tenantId")
  WITH CHECK (current_setting('app.tenant_id', true) = "tenantId");

-- 2. BusinessDocumentCounter (tenant-scoped, tenantId NOT NULL)
ALTER TABLE "BusinessDocumentCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessDocumentCounter" FORCE ROW LEVEL SECURITY;
CREATE POLICY "bdc_tenant_isolation" ON "BusinessDocumentCounter"
  FOR ALL
  USING (current_setting('app.tenant_id', true) = "tenantId")
  WITH CHECK (current_setting('app.tenant_id', true) = "tenantId");

-- 3. EmailActionToken (user-scoped, no tenantId; via userId)
ALTER TABLE "EmailActionToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailActionToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY "eat_user_isolation" ON "EmailActionToken"
  FOR ALL
  USING (current_setting('app.user_id', true) = "userId")
  WITH CHECK (current_setting('app.user_id', true) = "userId");

-- 4. EmailCampaign (global admin, no tenantId)
ALTER TABLE "EmailCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailCampaign" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ec_admin_only" ON "EmailCampaign"
  FOR ALL
  USING (current_setting('app.is_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_admin', true) = 'true');

-- 5. EmailCampaignRecipient (global via campaign, no tenantId)
ALTER TABLE "EmailCampaignRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailCampaignRecipient" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ecr_admin_only" ON "EmailCampaignRecipient"
  FOR ALL
  USING (current_setting('app.is_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_admin', true) = 'true');

-- 6. EmailDelivery (mixed: tenantId nullable)
ALTER TABLE "EmailDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailDelivery" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ed_tenant_or_null" ON "EmailDelivery"
  FOR ALL
  USING ("tenantId" IS NULL OR current_setting('app.tenant_id', true) = "tenantId")
  WITH CHECK ("tenantId" IS NULL OR current_setting('app.tenant_id', true) = "tenantId");

-- 7. PlatformTeamInvite (global admin, no tenantId)
ALTER TABLE "PlatformTeamInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformTeamInvite" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pti_admin_only" ON "PlatformTeamInvite"
  FOR ALL
  USING (current_setting('app.is_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_admin', true) = 'true');

-- Rollback:
-- DROP POLICY ... ON ...; ALTER TABLE ... DISABLE ROW LEVEL SECURITY;