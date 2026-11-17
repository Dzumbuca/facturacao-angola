import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueInvoice, issueCreditNote } from './invoice-service';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

let prisma: any = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}

describeIfDisposable('A12 — Audit events emitted on FT and NC', () => {
  let tenantId = '';

  beforeAll(async () => {
    if (!prisma) return;
    const suffix = Date.now().toString().slice(-6);
    tenantId = `a12-emit-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: `A12 ${suffix}`, plan: 'PRO', status: 'ACTIVE' } });
    await prisma.product.create({ data: { id: tenantId + '-p', tenantId, name: 'item', price: 100, stock: 1000, trackStock: false } });
  }, 30000);

  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  it('FT emission and NC emission both write an AuditEvent', async () => {
    if (!prisma) return;
    const ft = await issueInvoice({
      customerName: 'TestAudit', customerNif: '5000000001',
      items: [{ productId: tenantId + '-p', desc: 'entry', qty: 1, rate: 100 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, tenantId);
    const ftEvents = await prisma.auditEvent.findMany({ where: { tenantId, action: 'FT_ISSUED', entityId: ft.id } });
    expect(ftEvents.length).toBe(1);

    const nc = await issueCreditNote({
      invoiceId: ft.id,
      reason: 'Return defeito',
      tenantId,
    });
    const ncId = (nc as any).creditNote?.id ?? (nc as any).id;
    expect(ncId).toBeDefined();
    const ncEvents = await prisma.auditEvent.findMany({ where: { tenantId, action: 'NC_ISSUED', entityId: ncId } });
    expect(ncEvents.length).toBe(1);
  }, 60_000);
});
