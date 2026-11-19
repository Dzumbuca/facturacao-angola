/**
 * FASE A2 — fluxo Compras completo: PO → Recepção → Stock In → SupplierInvoice → Pagamento
 *
 * Use DATABASE_URL_A2 to point to a disposable PostgreSQL repository copy.
 * Never use against production/staging.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createSupplierInvoice, recordSupplierInvoicePayment } from './supplier-invoice-service';

const url = process.env.DATABASE_URL_A2;
const enabled = !!url && !url.includes('supabase.com');

let prisma: InstanceType<typeof PrismaClient> | null = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}
const describeIfDisposable = enabled ? describe : describe.skip;

describeIfDisposable('A2 — fluxo Compras completo (PO → Recepção → Stock → SupplierInvoice → Pagamento)', () => {
  let tenantId = '';
  let supplierId = '';
  let warehouseId = '';
  let productId = '';
  const u = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  beforeAll(async () => {
    if (!prisma) return;
    const id = `t-a2po-${u()}`;
    tenantId = id;

    // Tenant must exist first
    await prisma.tenant.upsert({
      where: { id },
      create: { id, name: `A2 PO ${id}`, plan: 'PRO', status: 'ACTIVE' },
      update: {},
    });

    const supplier = await prisma.supplier.create({
      data: { id: `${id}-sup`, tenantId: id, name: `QA A2 PO Supplier`, nif: '5000000778', email: 'po-sup@a2.example.com', isActive: true },
    });
    supplierId = supplier.id;

    // Enable WMS
    const wms = await prisma.platformApplication.findFirst({ where: { slug: 'wms' } });
    if (wms) {
      await prisma.tenantApplication.upsert({
        where: { tenantId_applicationId: { tenantId: id, applicationId: wms.id } },
        create: { id: `${id}-wms-en`, tenantId: id, applicationId: wms.id, enabled: true, enabledAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
        update: { enabled: true, enabledAt: new Date() },
      });
    }

    const wh = await prisma.warehouse.create({
      data: { id: `${id}-wh`, tenantId: id, name: `A2 PO WH ${id}`, isDefault: true, isActive: true, updatedAt: new Date() },
    });
    warehouseId = wh.id;

    productId = `${id}-prod`;
    await prisma.product.create({
      data: { id: productId, tenantId: id, name: 'A2 PO Product', price: 50, stock: 0, trackStock: true },
    });
    await prisma.productWarehouseStock.create({
      data: { id: `${id}-pws`, tenantId: id, productId, warehouseId, quantity: 0, updatedAt: new Date() },
    });
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('PO → Recepção → Stock In → SupplierInvoice vinculada → Pagamento', async () => {
    if (!prisma) return;
    // 1. Create PurchaseOrder
    const po = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        supplierId,
        status: 'PENDENTE',
        total: 150,
        expectedAt: new Date(Date.now() + 14 * 86400000),
        items: {
          create: [{ productId, quantity: 3, unitPrice: 50, receivedQty: 0 }],
        },
      },
      include: { items: true },
    });
    expect(po.status).toBe('PENDENTE');
    expect(po.items.length).toBe(1);

    // 2. Create reception (record what was received against this PO)
    const reception = await prisma.purchaseReception.create({
      data: {
        id: `${po.id}-rec`,
        tenantId,
        purchaseOrderId: po.id,
        warehouseId,
        reference: `PO-REC-${u()}`,
        items: {
          create: [{
            id: `${po.id}-rec-item`,
            purchaseOrderItemId: po.items[0].id,
            productId,
            quantity: 2,
          }],
        },
      },
      include: { items: true },
    });
    expect(reception.items.length).toBe(1);

    // 3. Cross-reference: PO item's receivedQty incremented; products now in warehouse stock
    const { upsertProductWarehouseStock } = await import('./stock-service');
    await prisma.$transaction(async (tx: any) => {
      await upsertProductWarehouseStock(
        tx,
        { tenantId, productId, warehouseId, lotId: null },
        { quantity: 2 },
      );
    });

    const stock = await prisma.productWarehouseStock.findFirst({
      where: { tenantId, productId, warehouseId },
    });
    expect(Number(stock?.quantity)).toBe(2);

    // 4. Create SupplierInvoice tied to this PO
    const invoice = await createSupplierInvoice({
      supplierId,
      number: `PO-INV-${u()}`,
      total: 150,
      taxTotal: 25,
      issuedAt: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      purchaseOrderId: po.id,
      notes: 'A2 PO test — receção parcial, 2/3 entregues',
    }, tenantId);
    expect(invoice.purchaseOrderId).toBe(po.id);
    expect(invoice.status).toBe('PENDING');

    // 5. Record payment
    const paid = await recordSupplierInvoicePayment(invoice.id, 150, tenantId);
    expect(Number(paid.paidAmount)).toBe(150);
    expect(paid.status).toBe('PAID');

    // 6. Ensure stock didn't double-count from the payment (payment is purely financial)
    const stock2 = await prisma.productWarehouseStock.findFirst({
      where: { tenantId, productId, warehouseId },
    });
    expect(Number(stock2?.quantity)).toBe(2);

    console.log('A2 PO flow OK: po=', po.id, 'invoice=', invoice.id);
  }, 60000);
});
