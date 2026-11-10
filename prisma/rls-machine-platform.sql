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

-- Machine RH (núcleo): isolamento estrito por empresa.
ALTER TABLE "RhDepartment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhPosition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhEmployee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhContract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhAuditLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_department_isolation" ON "RhDepartment";
CREATE POLICY "rh_department_isolation" ON "RhDepartment" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS "rh_position_isolation" ON "RhPosition";
CREATE POLICY "rh_position_isolation" ON "RhPosition" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS "rh_employee_isolation" ON "RhEmployee";
CREATE POLICY "rh_employee_isolation" ON "RhEmployee" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS "rh_contract_isolation" ON "RhContract";
CREATE POLICY "rh_contract_isolation" ON "RhContract" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS "rh_audit_isolation" ON "RhAuditLog";
CREATE POLICY "rh_audit_isolation" ON "RhAuditLog" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Machine Point: registos de ponto isolados por empresa.
ALTER TABLE "RhTimeEntry" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_time_entry_isolation" ON "RhTimeEntry";
CREATE POLICY "rh_time_entry_isolation" ON "RhTimeEntry" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
