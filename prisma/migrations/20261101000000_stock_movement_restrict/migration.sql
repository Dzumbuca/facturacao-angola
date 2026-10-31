-- Change FK from CASCADE to RESTRICT to preserve stock movement history.
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
