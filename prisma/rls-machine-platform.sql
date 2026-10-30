-- RLS policies for Machine Platform (Fase 1) new tables.
-- Idempotent: DROP + CREATE. Apply manually after review.
-- Requires: app.tenant_id set via set_config('app.tenant_id', <tenantId>, true) per request.

-- Enable RLS
ALTER TABLE "PlatformApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSubscription" ENABLE ROW LEVEL SECURITY;

-- PlatformApplication: readable by all authenticated; writable by platform admins only.
DROP POLICY IF EXISTS "platform_app_read" ON "PlatformApplication";
CREATE POLICY "platform_app_read" ON "PlatformApplication"
  FOR SELECT USING (true);

-- SubscriptionPlan: readable by all authenticated.
DROP POLICY IF EXISTS "subscription_plan_read" ON "SubscriptionPlan";
CREATE POLICY "subscription_plan_read" ON "SubscriptionPlan"
  FOR SELECT USING (true);

-- PlanApplication: readable by all authenticated.
DROP POLICY IF EXISTS "plan_application_read" ON "PlanApplication";
CREATE POLICY "plan_application_read" ON "PlanApplication"
  FOR SELECT USING (true);

-- TenantApplication: strict tenant isolation (read + write).
DROP POLICY IF EXISTS "tenant_application_isolation" ON "TenantApplication";
CREATE POLICY "tenant_application_isolation" ON "TenantApplication"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- TenantSubscription: strict tenant isolation (read + write).
DROP POLICY IF EXISTS "tenant_subscription_isolation" ON "TenantSubscription";
CREATE POLICY "tenant_subscription_isolation" ON "TenantSubscription"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
