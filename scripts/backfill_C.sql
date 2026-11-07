-- Backfill Script C (CORRECTED) — Reconciliation report
-- Compares Product.stock (legacy) with SUM(ProductWarehouseStock.quantity) per tenant+product.
-- Distinguishes justified vs unexplained differences.

WITH pws_agg AS (
  SELECT "tenantId", "productId", COALESCE(SUM(quantity), 0) AS total_pws
  FROM "ProductWarehouseStock"
  GROUP BY "tenantId", "productId"
),
movements AS (
  SELECT "tenantId", "productId",
    COALESCE(SUM(CASE WHEN "quantitySigned" > 0 THEN "quantitySigned" ELSE 0 END), 0) AS total_in,
    COALESCE(SUM(CASE WHEN "quantitySigned" < 0 THEN "quantitySigned" ELSE 0 END), 0) AS total_out
  FROM "StockMovement"
  GROUP BY "tenantId", "productId"
)
SELECT
  p."tenantId",
  p.id AS product_id,
  p.name,
  p.stock AS product_stock_legacy,
  COALESCE(a.total_pws, 0) AS pws_total,
  (p.stock - COALESCE(a.total_pws, 0)) AS difference,
  COALESCE(m.total_in, 0) AS movements_in,
  COALESCE(m.total_out, 0) AS movements_out,
  CASE
    WHEN a.total_pws IS NULL THEN 'sem PWS (requer criacao)'
    WHEN (p.stock - COALESCE(a.total_pws,0)) = 0 THEN 'consistent'
    WHEN COALESCE(m.total_out,0) <> 0 THEN 'diferenca possivelmente justificada por movimentos'
    ELSE 'diferenca nao explicada (investigar)'
  END AS classificacao
FROM "Product" p
LEFT JOIN pws_agg a ON a."tenantId" = p."tenantId" AND a."productId" = p.id
LEFT JOIN movements m ON m."tenantId" = p."tenantId" AND m."productId" = p.id
ORDER BY p."tenantId", p.id;