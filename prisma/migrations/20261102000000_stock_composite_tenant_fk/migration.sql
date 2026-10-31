-- Ensure composite candidate key on Product
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_tenant_id_unique') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_tenant_id_unique" UNIQUE ("tenantId","id");
  END IF;
END $$;

-- Replace simple FK with composite FK (tenant isolation at DB level)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_productId_fkey') THEN
    ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_tenant_product_fkey') THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_tenant_product_fkey"
      FOREIGN KEY ("tenantId","productId") REFERENCES "Product"("tenantId","id")
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;
