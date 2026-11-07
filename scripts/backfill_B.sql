-- Backfill Script B (CORRECTED) — NO-OP / analysis only
-- Original Script B overwrote PWS.quantity with Product.stock indiscriminately.
-- This corrected version does NOT modify any data.
-- It only reports divergences for manual review.

-- Report: products where Product.stock != SUM(PWS.quantity)
SELECT
  p."tenantId",
  p.id AS product_id,
  p.name,
  p.stock AS product_stock_legacy,
  COALESCE(SUM(pws.quantity), 0) AS pws_total,
  (p.stock - COALESCE(SUM(pws.quantity), 0)) AS difference
FROM "Product" p
LEFT JOIN "ProductWarehouseStock" pws
  ON pws."tenantId" = p."tenantId" AND pws."productId" = p.id
GROUP BY p."tenantId", p.id, p.name, p.stock
HAVING p.stock <> COALESCE(SUM(pws.quantity), 0)
ORDER BY p."tenantId", p.id;

-- No UPDATE/INSERT performed. Reconciliation is manual.