-- Baseline de stock: alinha uma BD criada apenas por migrations com o schema.prisma.
-- Contexto: as tabelas de stock foram criadas historicamente via `prisma db push`,
-- por isso não existiam em nenhuma migration.
-- Estratégia:
--   * BD nova: `migrate deploy` executa esta migration normalmente.
--   * BD existente (objetos já presentes): NÃO executar; registar com
--     `npx prisma migrate resolve --applied 20261107190000_stock_schema_baseline`.
-- Drops/criações de índices fora do domínio de stock foram excluídos
-- (drift de nomenclatura pré-existente noutras tabelas).

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');


-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('OPEN', 'CLOSED');


-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'FULFILLED');


-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_tenantId_fkey";


-- DropForeignKey
ALTER TABLE "Warehouse" DROP CONSTRAINT "Warehouse_tenantId_fkey";


-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "barcode" TEXT,
ALTER COLUMN "stock" SET DEFAULT 0,
ALTER COLUMN "stock" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "minStock" SET DEFAULT 0,
ALTER COLUMN "minStock" SET DATA TYPE DECIMAL(12,3);


-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "purchaseReceptionId" TEXT,
ADD COLUMN     "quantitySigned" DECIMAL(12,3),
ADD COLUMN     "reversalOfId" TEXT,
ADD COLUMN     "transferId" TEXT,
ADD COLUMN     "transferReceptionId" TEXT,
ADD COLUMN     "warehouseId" TEXT,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3);


-- CreateTable
CREATE TABLE "ProductWarehouseStock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reservedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "location" TEXT,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductWarehouseStock_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nif" TEXT,
    "contact" TEXT,
    "address" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "total" DECIMAL(12,2) NOT NULL,
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "receivedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "PurchaseReception" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "reference" TEXT,
    "notes" TEXT,

    CONSTRAINT "PurchaseReception_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "PurchaseReceptionItem" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "PurchaseReceptionItem_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "receivedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "rejectedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "StockTransferReception" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "reference" TEXT,
    "notes" TEXT,

    CONSTRAINT "StockTransferReception_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "StockTransferReceptionItem" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "transferItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rejectedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "StockTransferReceptionItem_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT,
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "StockAdjustmentItem" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "systemQty" DECIMAL(12,3) NOT NULL,
    "countedQty" DECIMAL(12,3) NOT NULL,
    "difference" DECIMAL(12,3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "StockAdjustmentItem_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "orderReference" TEXT,
    "orderType" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "ProductWarehouseStock_tenantId_warehouseId_idx" ON "ProductWarehouseStock"("tenantId", "warehouseId");


-- CreateIndex
CREATE INDEX "ProductWarehouseStock_tenantId_productId_idx" ON "ProductWarehouseStock"("tenantId", "productId");


-- CreateIndex
CREATE INDEX "ProductWarehouseStock_warehouseId_idx" ON "ProductWarehouseStock"("warehouseId");


-- CreateIndex
CREATE INDEX "ProductWarehouseStock_lotId_idx" ON "ProductWarehouseStock"("lotId");


-- CreateIndex
CREATE UNIQUE INDEX "ProductWarehouseStock_tenantId_id_key" ON "ProductWarehouseStock"("tenantId", "id");


-- CreateIndex
CREATE INDEX "StockLot_tenantId_productId_idx" ON "StockLot"("tenantId", "productId");


-- CreateIndex
CREATE INDEX "StockLot_tenantId_expiryDate_idx" ON "StockLot"("tenantId", "expiryDate");


-- CreateIndex
CREATE UNIQUE INDEX "StockLot_tenantId_id_key" ON "StockLot"("tenantId", "id");


-- CreateIndex
CREATE UNIQUE INDEX "StockLot_tenantId_productId_lotNumber_key" ON "StockLot"("tenantId", "productId", "lotNumber");


-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");


-- CreateIndex
CREATE INDEX "Supplier_nif_idx" ON "Supplier"("nif");


-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_id_key" ON "Supplier"("tenantId", "id");


-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_nif_key" ON "Supplier"("tenantId", "nif");


-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");


-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");


-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");


-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_id_key" ON "PurchaseOrder"("tenantId", "id");


-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");


-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");


-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderItem_tenantId_id_key" ON "PurchaseOrderItem"("tenantId", "id");


-- CreateIndex
CREATE INDEX "PurchaseReception_tenantId_idx" ON "PurchaseReception"("tenantId");


-- CreateIndex
CREATE INDEX "PurchaseReception_purchaseOrderId_idx" ON "PurchaseReception"("purchaseOrderId");


-- CreateIndex
CREATE INDEX "PurchaseReception_warehouseId_idx" ON "PurchaseReception"("warehouseId");


-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReception_tenantId_id_key" ON "PurchaseReception"("tenantId", "id");


-- CreateIndex
CREATE INDEX "PurchaseReceptionItem_receptionId_idx" ON "PurchaseReceptionItem"("receptionId");


-- CreateIndex
CREATE INDEX "PurchaseReceptionItem_purchaseOrderItemId_idx" ON "PurchaseReceptionItem"("purchaseOrderItemId");


-- CreateIndex
CREATE INDEX "StockTransfer_tenantId_idx" ON "StockTransfer"("tenantId");


-- CreateIndex
CREATE INDEX "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");


-- CreateIndex
CREATE INDEX "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");


-- CreateIndex
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");


-- CreateIndex
CREATE INDEX "StockTransfer_reference_idx" ON "StockTransfer"("reference");


-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_tenantId_id_key" ON "StockTransfer"("tenantId", "id");


-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_tenantId_fromWarehouseId_toWarehouseId_refere_key" ON "StockTransfer"("tenantId", "fromWarehouseId", "toWarehouseId", "reference");


-- CreateIndex
CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");


-- CreateIndex
CREATE INDEX "StockTransferItem_productId_idx" ON "StockTransferItem"("productId");


-- CreateIndex
CREATE INDEX "StockTransferItem_lotId_idx" ON "StockTransferItem"("lotId");


-- CreateIndex
CREATE UNIQUE INDEX "StockTransferItem_tenantId_id_key" ON "StockTransferItem"("tenantId", "id");


-- CreateIndex
CREATE INDEX "StockTransferReception_tenantId_idx" ON "StockTransferReception"("tenantId");


-- CreateIndex
CREATE INDEX "StockTransferReception_transferId_idx" ON "StockTransferReception"("transferId");


-- CreateIndex
CREATE INDEX "StockTransferReception_warehouseId_idx" ON "StockTransferReception"("warehouseId");


-- CreateIndex
CREATE UNIQUE INDEX "StockTransferReception_tenantId_id_key" ON "StockTransferReception"("tenantId", "id");


-- CreateIndex
CREATE INDEX "StockTransferReceptionItem_receptionId_idx" ON "StockTransferReceptionItem"("receptionId");


-- CreateIndex
CREATE INDEX "StockTransferReceptionItem_transferItemId_idx" ON "StockTransferReceptionItem"("transferItemId");


-- CreateIndex
CREATE INDEX "StockAdjustment_tenantId_idx" ON "StockAdjustment"("tenantId");


-- CreateIndex
CREATE INDEX "StockAdjustment_warehouseId_idx" ON "StockAdjustment"("warehouseId");


-- CreateIndex
CREATE INDEX "StockAdjustment_status_idx" ON "StockAdjustment"("status");


-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_tenantId_id_key" ON "StockAdjustment"("tenantId", "id");


-- CreateIndex
CREATE INDEX "StockAdjustmentItem_adjustmentId_idx" ON "StockAdjustmentItem"("adjustmentId");


-- CreateIndex
CREATE INDEX "StockReservation_tenantId_idx" ON "StockReservation"("tenantId");


-- CreateIndex
CREATE INDEX "StockReservation_warehouseId_idx" ON "StockReservation"("warehouseId");


-- CreateIndex
CREATE INDEX "StockReservation_orderReference_idx" ON "StockReservation"("orderReference");


-- CreateIndex
CREATE INDEX "StockReservation_expiresAt_idx" ON "StockReservation"("expiresAt");


-- CreateIndex
CREATE INDEX "StockReservation_status_idx" ON "StockReservation"("status");


-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");


-- CreateIndex
CREATE INDEX "Product_codigo_idx" ON "Product"("codigo");


-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_barcode_key" ON "Product"("tenantId", "barcode");


-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_reversalOfId_key" ON "StockMovement"("reversalOfId");


-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_idx" ON "StockMovement"("warehouseId");


-- CreateIndex
CREATE INDEX "StockMovement_transferId_idx" ON "StockMovement"("transferId");


-- CreateIndex
CREATE INDEX "StockMovement_purchaseReceptionId_idx" ON "StockMovement"("purchaseReceptionId");


-- CreateIndex
CREATE INDEX "StockMovement_transferReceptionId_idx" ON "StockMovement"("transferReceptionId");


-- CreateIndex
CREATE INDEX "StockMovement_reversalOfId_idx" ON "StockMovement"("reversalOfId");


-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");


-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_tenantId_id_key" ON "StockMovement"("tenantId", "id");


-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_tenantId_idempotencyKey_key" ON "StockMovement"("tenantId", "idempotencyKey");


-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_tenantId_transferReceptionId_key" ON "StockMovement"("tenantId", "transferReceptionId");


-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_tenantId_reversalOfId_key" ON "StockMovement"("tenantId", "reversalOfId");


-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_tenantId_id_key" ON "Warehouse"("tenantId", "id");


-- RenameForeignKey
ALTER TABLE "StockMovement" RENAME CONSTRAINT "StockMovement_tenant_product_fkey" TO "StockMovement_tenantId_productId_fkey";


-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "ProductWarehouseStock" ADD CONSTRAINT "ProductWarehouseStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "ProductWarehouseStock" ADD CONSTRAINT "ProductWarehouseStock_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "StockLot"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "ProductWarehouseStock" ADD CONSTRAINT "ProductWarehouseStock_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "ProductWarehouseStock" ADD CONSTRAINT "ProductWarehouseStock_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_supplierId_fkey" FOREIGN KEY ("tenantId", "supplierId") REFERENCES "Supplier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_tenantId_purchaseOrderId_fkey" FOREIGN KEY ("tenantId", "purchaseOrderId") REFERENCES "PurchaseOrder"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseReception" ADD CONSTRAINT "PurchaseReception_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseReception" ADD CONSTRAINT "PurchaseReception_tenantId_purchaseOrderId_fkey" FOREIGN KEY ("tenantId", "purchaseOrderId") REFERENCES "PurchaseOrder"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseReception" ADD CONSTRAINT "PurchaseReception_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseReceptionItem" ADD CONSTRAINT "PurchaseReceptionItem_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "StockLot"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseReceptionItem" ADD CONSTRAINT "PurchaseReceptionItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseReceptionItem" ADD CONSTRAINT "PurchaseReceptionItem_tenantId_purchaseOrderItemId_fkey" FOREIGN KEY ("tenantId", "purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "PurchaseReceptionItem" ADD CONSTRAINT "PurchaseReceptionItem_tenantId_receptionId_fkey" FOREIGN KEY ("tenantId", "receptionId") REFERENCES "PurchaseReception"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenantId_fromWarehouseId_fkey" FOREIGN KEY ("tenantId", "fromWarehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenantId_toWarehouseId_fkey" FOREIGN KEY ("tenantId", "toWarehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "StockLot"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_tenantId_transferId_fkey" FOREIGN KEY ("tenantId", "transferId") REFERENCES "StockTransfer"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferReception" ADD CONSTRAINT "StockTransferReception_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferReception" ADD CONSTRAINT "StockTransferReception_tenantId_transferId_fkey" FOREIGN KEY ("tenantId", "transferId") REFERENCES "StockTransfer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferReception" ADD CONSTRAINT "StockTransferReception_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferReceptionItem" ADD CONSTRAINT "StockTransferReceptionItem_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "StockLot"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferReceptionItem" ADD CONSTRAINT "StockTransferReceptionItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferReceptionItem" ADD CONSTRAINT "StockTransferReceptionItem_tenantId_receptionId_fkey" FOREIGN KEY ("tenantId", "receptionId") REFERENCES "StockTransferReception"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockTransferReceptionItem" ADD CONSTRAINT "StockTransferReceptionItem_tenantId_transferItemId_fkey" FOREIGN KEY ("tenantId", "transferItemId") REFERENCES "StockTransferItem"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_tenantId_adjustmentId_fkey" FOREIGN KEY ("tenantId", "adjustmentId") REFERENCES "StockAdjustment"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_tenantId_stockId_fkey" FOREIGN KEY ("tenantId", "stockId") REFERENCES "ProductWarehouseStock"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_stockId_fkey" FOREIGN KEY ("tenantId", "stockId") REFERENCES "ProductWarehouseStock"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reversalOfId_fkey" FOREIGN KEY ("tenantId", "reversalOfId") REFERENCES "StockMovement"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_purchaseReceptionId_fkey" FOREIGN KEY ("tenantId", "purchaseReceptionId") REFERENCES "PurchaseReception"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_transferId_fkey" FOREIGN KEY ("tenantId", "transferId") REFERENCES "StockTransfer"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_transferReceptionId_fkey" FOREIGN KEY ("tenantId", "transferReceptionId") REFERENCES "StockTransferReception"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
