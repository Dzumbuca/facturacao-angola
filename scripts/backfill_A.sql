-- Backfill Script A (CORRECTED) — Create missing ProductWarehouseStock records
-- Idempotent: only inserts where no PWS exists for (tenantId, productId, warehouseId)
-- Preserves existing PWS records. Does NOT overwrite quantities.
-- Run in transaction; record inserted IDs for rollback.

BEGIN;

-- Temporary audit table for rollback tracking
CREATE TEMP TABLE _backfill_a_ids (id uuid PRIMARY KEY);

WITH default_warehouses AS (
  SELECT w.id AS warehouse_id, w."tenantId"
  FROM "Warehouse" w
  WHERE w."isDefault" = true AND w."isActive" = true
),
missing AS (
  SELECT p.id AS product_id, p."tenantId", dw.warehouse_id
  FROM "Product" p
  JOIN default_warehouses dw ON dw."tenantId" = p."tenantId"
  WHERE NOT EXISTS (
    SELECT 1 FROM "ProductWarehouseStock" pws
    WHERE pws."tenantId" = p."tenantId"
      AND pws."productId" = p.id
      AND pws."warehouseId" = dw.warehouse_id
  )
)
INSERT INTO "ProductWarehouseStock" (
  id, "tenantId", "productId", "warehouseId", "lotId",
  quantity, "reservedQuantity", "minStock", location, "isLegacy",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  m."tenantId",
  m.product_id,
  m.warehouse_id,
  NULL,
  0,           -- quantity starts at 0; reconciliation is manual, not copied from Product.stock
  0,
  p."minStock",
  NULL,
  true,
  now(),
  now()
FROM missing m
JOIN "Product" p ON p.id = m.product_id AND p."tenantId" = m."tenantId"
RETURNING id INTO _backfill_a_ids;

-- Rollback reference: SELECT id FROM _backfill_a_ids;
COMMIT;