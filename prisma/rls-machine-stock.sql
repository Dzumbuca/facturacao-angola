-- Políticas RLS para Machine Stock - Product, Warehouse, StockMovement
-- Executar apenas em STAGING, depois em PRODUÇÃO com autorização.

-- 1. Habilitar RLS nas três tabelas
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para Product
DROP POLICY IF EXISTS "product_tenant_isolation" ON "Product";
CREATE POLICY "product_tenant_isolation" ON "Product"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- 3. Políticas para Warehouse
DROP POLICY IF EXISTS "warehouse_tenant_isolation" ON "Warehouse";
CREATE POLICY "warehouse_tenant_isolation" ON "Warehouse"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- 4. Políticas para StockMovement
DROP POLICY IF EXISTS "stockmovement_tenant_isolation" ON "StockMovement";
CREATE POLICY "stockmovement_tenant_isolation" ON "StockMovement"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
