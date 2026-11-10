-- Catálogo de produtos: campos de organização e identificação.
-- (Aplicado apenas em ambiente de testes/descartável; produção aguarda autorização.)

ALTER TABLE "Product" ADD COLUMN "subcategoria" TEXT;
ALTER TABLE "Product" ADD COLUMN "marca" TEXT;
ALTER TABLE "Product" ADD COLUMN "modelo" TEXT;
ALTER TABLE "Product" ADD COLUMN "unidade" TEXT NOT NULL DEFAULT 'un';
ALTER TABLE "Product" ADD COLUMN "purchasePrice" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;
