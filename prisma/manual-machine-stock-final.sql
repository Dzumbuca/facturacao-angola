-- Machine Stock final migration (additive)
-- 1) Product.minStock
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minStock" INTEGER NOT NULL DEFAULT 0;

-- 2) Enum
DO $$ BEGIN
  CREATE TYPE "StockMovementType" AS ENUM ('IN','OUT','ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Tables
CREATE TABLE IF NOT EXISTS "Warehouse" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "StockMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reason" TEXT,
  "reference" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- 4) Indexes
CREATE INDEX IF NOT EXISTS "Warehouse_tenantId_idx" ON "Warehouse"("tenantId");
CREATE INDEX IF NOT EXISTS "StockMovement_tenantId_idx" ON "StockMovement"("tenantId");
CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement"("productId");

-- 5) FKs
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite FK (tenant isolation at DB level)
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenant_id_unique" UNIQUE ("tenantId","id");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenant_product_fkey" FOREIGN KEY ("tenantId","productId") REFERENCES "Product"("tenantId","id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6) RLS
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_tenant_isolation" ON "Warehouse";
CREATE POLICY "warehouse_tenant_isolation" ON "Warehouse"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS "stockmovement_tenant_isolation" ON "StockMovement";
CREATE POLICY "stockmovement_tenant_isolation" ON "StockMovement"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
