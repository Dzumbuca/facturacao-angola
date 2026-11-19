-- A2: SupplierInvoice modelo — contas a pagar tracking
-- Add the SupplierInvoice table with full multi-tenant integrity
CREATE TABLE "SupplierInvoice" (
    "id"              TEXT          NOT NULL,
    "tenantId"        TEXT          NOT NULL,
    "number"          TEXT          NOT NULL,
    "supplierId"      TEXT          NOT NULL,
    "purchaseOrderId" TEXT,
    "total"           DECIMAL(12,2) NOT NULL,
    "taxTotal"        DECIMAL(12,2) NOT NULL,
    "paidAmount"      DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency"        TEXT          NOT NULL DEFAULT 'AOA',
    "issuedAt"        TIMESTAMP(3)  NOT NULL,
    "dueDate"         TIMESTAMP(3),
    "status"          TEXT          NOT NULL DEFAULT 'PENDING',
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- Indexes for performance
CREATE UNIQUE INDEX "SupplierInvoice_tenantId_number_key" ON "SupplierInvoice"("tenantId", "number");
CREATE INDEX "SupplierInvoice_tenantId_status_idx" ON "SupplierInvoice"("tenantId", "status");
CREATE INDEX "SupplierInvoice_tenantId_supplierId_idx" ON "SupplierInvoice"("tenantId", "supplierId");
CREATE INDEX "SupplierInvoice_tenantId_dueDate_idx" ON "SupplierInvoice"("tenantId", "dueDate");
CREATE UNIQUE INDEX "SupplierInvoice_tenantId_id_key" ON "SupplierInvoice"("tenantId", "id");

-- Composite unique for FK to Tenant
ALTER TABLE "SupplierInvoice"
    ADD CONSTRAINT "SupplierInvoice_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite FK to Supplier (tenant-scoped)
ALTER TABLE "SupplierInvoice"
    ADD CONSTRAINT "SupplierInvoice_supplier_tenant_fkey"
    FOREIGN KEY ("tenantId", "supplierId")
    REFERENCES "Supplier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Optional FK to PurchaseOrder (tenant-scoped)
ALTER TABLE "SupplierInvoice"
    ADD CONSTRAINT "SupplierInvoice_purchase_order_tenant_fkey"
    FOREIGN KEY ("tenantId", "purchaseOrderId")
    REFERENCES "PurchaseOrder"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
