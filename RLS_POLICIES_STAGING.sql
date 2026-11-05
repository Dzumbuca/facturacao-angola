-- RLS_POLICIES_STAGING.sql — LOCAL TEST DB ONLY (127.0.0.1:5437/mf_rls_staging)
-- DO NOT run in Supabase production. Policies designed for app.tenant_id/app.user_id/app.is_admin GUCs
-- set inside the same transaction as queries (SET LOCAL / set_config(..., true)).

-- Helper note: mf_app_nobypass / mf_admin_executor have NO BYPASSRLS. Postgres superuser bypasses RLS.

-- ========== TENANT-SCOPED TABLES (have tenantId) ==========
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Customer','Product','Invoice','Payment','PaymentEvent','PaymentReceipt','PlanPayment',
    'Supplier','Warehouse','StockMovement',
    'BusinessDocument','BusinessDocumentCounter','BusinessDocumentEvent','BusinessDocumentItem',
    'CompanyBankAccount','CompanyLogo',
    'InvoiceDraft',
    'ProductWarehouseStock','StockLot','StockAdjustment','StockAdjustmentItem','StockReservation',
    'StockTransfer','StockTransferItem','StockTransferReception','StockTransferReceptionItem',
    'PurchaseOrder','PurchaseOrderItem','PurchaseReception','PurchaseReceptionItem',
    'TenantApplication','TenantSubscription'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS rls_tenant_isolation ON %I', t);
      EXECUTE format($p$
        CREATE POLICY rls_tenant_isolation ON %I
        FOR ALL
        TO PUBLIC
        USING (
          current_setting('app.is_admin', true) = 'true'
          OR current_setting('app.tenant_id', true) = "tenantId"::text
        )
        WITH CHECK (
          current_setting('app.is_admin', true) = 'true'
          OR current_setting('app.tenant_id', true) = "tenantId"::text
        )
      $p$, t);
    END IF;
  END LOOP;
END $rls$;

-- ========== InvoiceItem (no tenantId) — isolate via parent Invoice ==========
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='InvoiceItem') THEN
  ALTER TABLE "InvoiceItem" ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS rls_invoiceitem_via_invoice ON "InvoiceItem";
  CREATE POLICY rls_invoiceitem_via_invoice ON "InvoiceItem"
  FOR ALL TO PUBLIC
  USING (
    current_setting('app.is_admin', true) = 'true'
    OR EXISTS (SELECT 1 FROM "Invoice" i WHERE i.id = "invoiceId" AND i."tenantId"::text = current_setting('app.tenant_id', true))
  )
  WITH CHECK (
    current_setting('app.is_admin', true) = 'true'
    OR EXISTS (SELECT 1 FROM "Invoice" i WHERE i.id = "invoiceId" AND i."tenantId"::text = current_setting('app.tenant_id', true))
  );
END IF; END $$;

-- ========== AdUnlock (tenant_id snake_case) ==========
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='AdUnlock') THEN
  ALTER TABLE "AdUnlock" ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS rls_adunlock_tenant ON "AdUnlock";
  CREATE POLICY rls_adunlock_tenant ON "AdUnlock"
  FOR ALL TO PUBLIC
  USING (current_setting('app.is_admin', true)='true' OR current_setting('app.tenant_id', true)=tenant_id::text)
  WITH CHECK (current_setting('app.is_admin', true)='true' OR current_setting('app.tenant_id', true)=tenant_id::text);
END IF; END $$;

-- ========== Tenant (own tenant readable/writable by admin; app sees own tenant row) ==========
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Tenant') THEN
  ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS rls_tenant_self_or_admin ON "Tenant";
  CREATE POLICY rls_tenant_self_or_admin ON "Tenant"
  FOR ALL TO PUBLIC
  USING (current_setting('app.is_admin', true)='true' OR current_setting('app.tenant_id', true)=id::text)
  WITH CHECK (current_setting('app.is_admin', true)='true' OR current_setting('app.tenant_id', true)=id::text);
END IF; END $$;

-- ========== EmailDelivery (tenantId nullable) ==========
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='EmailDelivery') THEN
  ALTER TABLE "EmailDelivery" ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS rls_emaildelivery_tenant_or_global ON "EmailDelivery";
  CREATE POLICY rls_emaildelivery_tenant_or_global ON "EmailDelivery"
  FOR ALL TO PUBLIC
  USING (
    current_setting('app.is_admin', true)='true'
    OR "tenantId" IS NULL
    OR current_setting('app.tenant_id', true)="tenantId"::text
  )
  WITH CHECK (
    current_setting('app.is_admin', true)='true'
    OR "tenantId" IS NULL
    OR current_setting('app.tenant_id', true)="tenantId"::text
  );
END IF; END $$;

-- ========== User (special: own row, same tenant, or admin; auth executor handled separately in prototype) ==========
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') THEN
  ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS rls_user_self_tenant_admin ON "User";
  CREATE POLICY rls_user_self_tenant_admin ON "User"
  FOR ALL TO PUBLIC
  USING (
    current_setting('app.is_admin', true)='true'
    OR (current_setting('app.user_id', true) <> '' AND current_setting('app.user_id', true)=id::text)
    OR (current_setting('app.tenant_id', true) <> '' AND "tenantId" IS NOT NULL AND current_setting('app.tenant_id', true)="tenantId"::text)
  )
  WITH CHECK (
    current_setting('app.is_admin', true)='true'
    OR (current_setting('app.user_id', true) <> '' AND current_setting('app.user_id', true)=id::text)
  );
END IF; END $$;

-- ========== Admin/global tables (admin executor or explicit global) ==========
DO $adm$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'AdminAuditLog','EmailCampaign','EmailCampaignRecipient','PlatformTeamInvite',
    'PlatformApplication','SubscriptionPlan','PlanApplication','PlatformConfig',
    'MarketingPreference','EmailRequestLimit'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS rls_admin_only ON %I', t);
      EXECUTE format($p$ CREATE POLICY rls_admin_only ON %I FOR ALL TO PUBLIC
        USING (current_setting('app.is_admin', true)='true')
        WITH CHECK (current_setting('app.is_admin', true)='true') $p$, t);
    END IF;
  END LOOP;
END $adm$;

-- ========== Auth/NextAuth-sensitive tables — NOT enabled here (prototype ETAPA 6). ==========
-- Account, Session, VerificationToken, EmailActionToken require isolated auth executor/policies.
-- Enabling tenant RLS generically would break Prisma adapter/auth flows. See RLS_NEXTAUTH_PROTOTYPE_REPORT.md.
