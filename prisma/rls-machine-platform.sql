-- RLS policies for Machine Platform (Fase 1) new tables.
-- Apply manually after migration. Idempotent where possible.

ALTER TABLE "PlatformApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSubscription" ENABLE ROW LEVEL SECURITY;

-- PlatformApplication / SubscriptionPlan / PlanApplication: readable by all authenticated, writable by platform admins only.
CREATE POLICY IF NOT EXISTS "platform_app_read" ON "PlatformApplication" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "subscription_plan_read" ON "SubscriptionPlan" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "plan_application_read" ON "PlanApplication" FOR SELECT USING (true);

-- TenantApplication / TenantSubscription: tenant isolation.
CREATE POLICY IF NOT EXISTS "tenant_application_isolation" ON "TenantApplication"
  FOR ALL USING ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY IF NOT EXISTS "tenant_subscription_isolation" ON "TenantSubscription"
  FOR ALL USING ("tenantId" = current_setting('app.tenant_id', true));
