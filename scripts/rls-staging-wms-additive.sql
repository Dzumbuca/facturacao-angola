-- Curated additive WMS DDL for mf_rls_staging (5437) ONLY. No drops, no prod. Idempotent where practical.

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='StockTransferStatus') THEN
CREATE TYPE "StockTransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='AdjustmentStatus') THEN
CREATE TYPE "AdjustmentStatus" AS ENUM ('OPEN', 'CLOSED');
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='ReservationStatus') THEN
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED', 'FULFILLED');
END IF; END $$;

CREATE TABLE IF NOT EXISTS "ProductWarehouseStock" (
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

CREATE TABLE IF NOT EXISTS "StockLot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Supplier" (
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

CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
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

CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "receivedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseReception" (
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

CREATE TABLE IF NOT EXISTS "PurchaseReceptionItem" (
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

CREATE TABLE IF NOT EXISTS "StockTransfer" (
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

CREATE TABLE IF NOT EXISTS "StockTransferItem" (
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

CREATE TABLE IF NOT EXISTS "StockTransferReception" (
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

CREATE TABLE IF NOT EXISTS "StockTransferReceptionItem" (
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

CREATE TABLE IF NOT EXISTS "StockAdjustment" (
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

CREATE TABLE IF NOT EXISTS "StockAdjustmentItem" (
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

CREATE TABLE IF NOT EXISTS "StockReservation" (
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

CREATE INDEX IF NOT EXISTS "ProductWarehouseStock_tenantId_warehouseId_idx" ON "ProductWarehouseStock"("tenantId", "warehouseId");

CREATE INDEX IF NOT EXISTS "ProductWarehouseStock_tenantId_productId_idx" ON "ProductWarehouseStock"("tenantId", "productId");

CREATE INDEX IF NOT EXISTS "ProductWarehouseStock_warehouseId_idx" ON "ProductWarehouseStock"("warehouseId");

CREATE INDEX IF NOT EXISTS "ProductWarehouseStock_lotId_idx" ON "ProductWarehouseStock"("lotId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductWarehouseStock_tenantId_id_key" ON "ProductWarehouseStock"("tenantId", "id");

CREATE INDEX IF NOT EXISTS "StockLot_tenantId_productId_idx" ON "StockLot"("tenantId", "productId");

CREATE INDEX IF NOT EXISTS "StockLot_tenantId_expiryDate_idx" ON "StockLot"("tenantId", "expiryDate");

CREATE UNIQUE INDEX IF NOT EXISTS "StockLot_tenantId_id_key" ON "StockLot"("tenantId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "StockLot_tenantId_productId_lotNumber_key" ON "StockLot"("tenantId", "productId", "lotNumber");

CREATE INDEX IF NOT EXISTS "Supplier_tenantId_idx" ON "Supplier"("tenantId");

CREATE INDEX IF NOT EXISTS "Supplier_nif_idx" ON "Supplier"("nif");

CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_tenantId_id_key" ON "Supplier"("tenantId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_tenantId_nif_key" ON "Supplier"("tenantId", "nif");

CREATE INDEX IF NOT EXISTS "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");

CREATE INDEX IF NOT EXISTS "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

CREATE INDEX IF NOT EXISTS "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_tenantId_id_key" ON "PurchaseOrder"("tenantId", "id");

CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrderItem_tenantId_id_key" ON "PurchaseOrderItem"("tenantId", "id");

CREATE INDEX IF NOT EXISTS "PurchaseReception_tenantId_idx" ON "PurchaseReception"("tenantId");

CREATE INDEX IF NOT EXISTS "PurchaseReception_purchaseOrderId_idx" ON "PurchaseReception"("purchaseOrderId");

CREATE INDEX IF NOT EXISTS "PurchaseReception_warehouseId_idx" ON "PurchaseReception"("warehouseId");

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseReception_tenantId_id_key" ON "PurchaseReception"("tenantId", "id");

CREATE INDEX IF NOT EXISTS "PurchaseReceptionItem_receptionId_idx" ON "PurchaseReceptionItem"("receptionId");

CREATE INDEX IF NOT EXISTS "PurchaseReceptionItem_purchaseOrderItemId_idx" ON "PurchaseReceptionItem"("purchaseOrderItemId");

CREATE INDEX IF NOT EXISTS "StockTransfer_tenantId_idx" ON "StockTransfer"("tenantId");

CREATE INDEX IF NOT EXISTS "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");

CREATE INDEX IF NOT EXISTS "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");

CREATE INDEX IF NOT EXISTS "StockTransfer_status_idx" ON "StockTransfer"("status");

CREATE INDEX IF NOT EXISTS "StockTransfer_reference_idx" ON "StockTransfer"("reference");

CREATE UNIQUE INDEX IF NOT EXISTS "StockTransfer_tenantId_id_key" ON "StockTransfer"("tenantId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "StockTransfer_tenantId_fromWarehouseId_toWarehouseId_refere_key" ON "StockTransfer"("tenantId", "fromWarehouseId", "toWarehouseId", "reference");

CREATE INDEX IF NOT EXISTS "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");

CREATE INDEX IF NOT EXISTS "StockTransferItem_productId_idx" ON "StockTransferItem"("productId");

CREATE INDEX IF NOT EXISTS "StockTransferItem_lotId_idx" ON "StockTransferItem"("lotId");

CREATE UNIQUE INDEX IF NOT EXISTS "StockTransferItem_tenantId_id_key" ON "StockTransferItem"("tenantId", "id");

CREATE INDEX IF NOT EXISTS "StockTransferReception_tenantId_idx" ON "StockTransferReception"("tenantId");

CREATE INDEX IF NOT EXISTS "StockTransferReception_transferId_idx" ON "StockTransferReception"("transferId");

CREATE INDEX IF NOT EXISTS "StockTransferReception_warehouseId_idx" ON "StockTransferReception"("warehouseId");

CREATE UNIQUE INDEX IF NOT EXISTS "StockTransferReception_tenantId_id_key" ON "StockTransferReception"("tenantId", "id");

CREATE INDEX IF NOT EXISTS "StockTransferReceptionItem_receptionId_idx" ON "StockTransferReceptionItem"("receptionId");

CREATE INDEX IF NOT EXISTS "StockTransferReceptionItem_transferItemId_idx" ON "StockTransferReceptionItem"("transferItemId");

CREATE INDEX IF NOT EXISTS "StockAdjustment_tenantId_idx" ON "StockAdjustment"("tenantId");

CREATE INDEX IF NOT EXISTS "StockAdjustment_warehouseId_idx" ON "StockAdjustment"("warehouseId");

CREATE INDEX IF NOT EXISTS "StockAdjustment_status_idx" ON "StockAdjustment"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "StockAdjustment_tenantId_id_key" ON "StockAdjustment"("tenantId", "id");

CREATE INDEX IF NOT EXISTS "StockAdjustmentItem_adjustmentId_idx" ON "StockAdjustmentItem"("adjustmentId");

CREATE INDEX IF NOT EXISTS "StockReservation_tenantId_idx" ON "StockReservation"("tenantId");

CREATE INDEX IF NOT EXISTS "StockReservation_warehouseId_idx" ON "StockReservation"("warehouseId");

CREATE INDEX IF NOT EXISTS "StockReservation_orderReference_idx" ON "StockReservation"("orderReference");

CREATE INDEX IF NOT EXISTS "StockReservation_expiresAt_idx" ON "StockReservation"("expiresAt");

CREATE INDEX IF NOT EXISTS "StockReservation_status_idx" ON "StockReservation"("status");

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProductWarehouseStock_tenantId_fkey') THEN ALTER TABLE "ProductWarehouseStock" ADD CONSTRAINT "ProductWarehouseStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProductWarehouseStock_tenantId_lotId_fkey') THEN ALTER TABLE "ProductWarehouseStock" ADD CONSTRAINT "ProductWarehouseStock_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "StockLot"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProductWarehouseStock_tenantId_productId_fkey') THEN ALTER TABLE "ProductWarehouseStock" ADD CONSTRAINT "ProductWarehouseStock_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProductWarehouseStock_tenantId_warehouseId_fkey') THEN ALTER TABLE "ProductWarehouseStock" ADD CONSTRAINT "ProductWarehouseStock_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockLot_tenantId_fkey') THEN ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockLot_tenantId_productId_fkey') THEN ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Supplier_tenantId_fkey') THEN ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseOrder_tenantId_fkey') THEN ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseOrder_tenantId_supplierId_fkey') THEN ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_supplierId_fkey" FOREIGN KEY ("tenantId", "supplierId") REFERENCES "Supplier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseOrderItem_tenantId_productId_fkey') THEN ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseOrderItem_tenantId_purchaseOrderId_fkey') THEN ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_tenantId_purchaseOrderId_fkey" FOREIGN KEY ("tenantId", "purchaseOrderId") REFERENCES "PurchaseOrder"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseReception_tenantId_fkey') THEN ALTER TABLE "PurchaseReception" ADD CONSTRAINT "PurchaseReception_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseReception_tenantId_purchaseOrderId_fkey') THEN ALTER TABLE "PurchaseReception" ADD CONSTRAINT "PurchaseReception_tenantId_purchaseOrderId_fkey" FOREIGN KEY ("tenantId", "purchaseOrderId") REFERENCES "PurchaseOrder"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseReception_tenantId_warehouseId_fkey') THEN ALTER TABLE "PurchaseReception" ADD CONSTRAINT "PurchaseReception_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseReceptionItem_tenantId_lotId_fkey') THEN ALTER TABLE "PurchaseReceptionItem" ADD CONSTRAINT "PurchaseReceptionItem_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "StockLot"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseReceptionItem_tenantId_productId_fkey') THEN ALTER TABLE "PurchaseReceptionItem" ADD CONSTRAINT "PurchaseReceptionItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseReceptionItem_tenantId_purchaseOrderItemId_fkey') THEN ALTER TABLE "PurchaseReceptionItem" ADD CONSTRAINT "PurchaseReceptionItem_tenantId_purchaseOrderItemId_fkey" FOREIGN KEY ("tenantId", "purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='PurchaseReceptionItem_tenantId_receptionId_fkey') THEN ALTER TABLE "PurchaseReceptionItem" ADD CONSTRAINT "PurchaseReceptionItem_tenantId_receptionId_fkey" FOREIGN KEY ("tenantId", "receptionId") REFERENCES "PurchaseReception"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransfer_tenantId_fkey') THEN ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransfer_tenantId_fromWarehouseId_fkey') THEN ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenantId_fromWarehouseId_fkey" FOREIGN KEY ("tenantId", "fromWarehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransfer_tenantId_toWarehouseId_fkey') THEN ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenantId_toWarehouseId_fkey" FOREIGN KEY ("tenantId", "toWarehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferItem_tenantId_lotId_fkey') THEN ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "StockLot"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferItem_tenantId_productId_fkey') THEN ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferItem_tenantId_transferId_fkey') THEN ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_tenantId_transferId_fkey" FOREIGN KEY ("tenantId", "transferId") REFERENCES "StockTransfer"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferReception_tenantId_fkey') THEN ALTER TABLE "StockTransferReception" ADD CONSTRAINT "StockTransferReception_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferReception_tenantId_transferId_fkey') THEN ALTER TABLE "StockTransferReception" ADD CONSTRAINT "StockTransferReception_tenantId_transferId_fkey" FOREIGN KEY ("tenantId", "transferId") REFERENCES "StockTransfer"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferReception_tenantId_warehouseId_fkey') THEN ALTER TABLE "StockTransferReception" ADD CONSTRAINT "StockTransferReception_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferReceptionItem_tenantId_lotId_fkey') THEN ALTER TABLE "StockTransferReceptionItem" ADD CONSTRAINT "StockTransferReceptionItem_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "StockLot"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferReceptionItem_tenantId_productId_fkey') THEN ALTER TABLE "StockTransferReceptionItem" ADD CONSTRAINT "StockTransferReceptionItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferReceptionItem_tenantId_receptionId_fkey') THEN ALTER TABLE "StockTransferReceptionItem" ADD CONSTRAINT "StockTransferReceptionItem_tenantId_receptionId_fkey" FOREIGN KEY ("tenantId", "receptionId") REFERENCES "StockTransferReception"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockTransferReceptionItem_tenantId_transferItemId_fkey') THEN ALTER TABLE "StockTransferReceptionItem" ADD CONSTRAINT "StockTransferReceptionItem_tenantId_transferItemId_fkey" FOREIGN KEY ("tenantId", "transferItemId") REFERENCES "StockTransferItem"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockAdjustment_tenantId_fkey') THEN ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockAdjustment_tenantId_warehouseId_fkey') THEN ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockAdjustmentItem_tenantId_adjustmentId_fkey') THEN ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_tenantId_adjustmentId_fkey" FOREIGN KEY ("tenantId", "adjustmentId") REFERENCES "StockAdjustment"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockAdjustmentItem_tenantId_productId_fkey') THEN ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockAdjustmentItem_tenantId_stockId_fkey') THEN ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_tenantId_stockId_fkey" FOREIGN KEY ("tenantId", "stockId") REFERENCES "ProductWarehouseStock"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockReservation_tenantId_fkey') THEN ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockReservation_tenantId_productId_fkey') THEN ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_productId_fkey" FOREIGN KEY ("tenantId", "productId") REFERENCES "Product"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockReservation_tenantId_stockId_fkey') THEN ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_stockId_fkey" FOREIGN KEY ("tenantId", "stockId") REFERENCES "ProductWarehouseStock"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='StockReservation_tenantId_warehouseId_fkey') THEN ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_warehouseId_fkey" FOREIGN KEY ("tenantId", "warehouseId") REFERENCES "Warehouse"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
