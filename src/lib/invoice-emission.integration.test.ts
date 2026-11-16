/**
 * Testes de integração reais (não-mock) contra PostgreSQL via DATABASE_URL_A1.
 *
 * Esta suite assume uma base descartável a ser criada a partir da migration
 * oficial. Não usar contra produção/staging.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueInvoice, issueCreditNote } from './invoice-service';

const url = process.env.DATABASE_URL_A1;
const enabled = !!url;

let prisma: InstanceType<typeof PrismaClient>| null = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } } });
}

const describeIfReal = enabled ? describe : describe.skip;

describeIfReal('A1.1 — Integrity motor against real PostgreSQL', () => {
  beforeAll(async () => {
    if (!prisma) return;
    // Seed ONLY if tenants absent (don't pollute)
    const t1 = await prisma.tenant.findUnique({ where: { id: 't-a1test-tenant-a' } });
    if (!t1) {
      await prisma.tenant.create({ data: { id: 't-a1test-tenant-a', name: 'QA Tenant A', plan: 'PRO', status: 'ACTIVE' } });
      await prisma.customer.create({ data: { id: 't-a1test-cust-a', tenantId: 't-a1test-tenant-a', name: 'Cliente QA A', nif: '5000000001' } });
    }
    const t2 = await prisma.tenant.findUnique({ where: { id: 't-a1test-tenant-b' } });
    if (!t2) {
      await prisma.tenant.create({ data: { id: 't-a1test-tenant-b', name: 'QA Tenant B', plan: 'PRO', status: 'ACTIVE' } });
      await prisma.customer.create({ data: { id: 't-a1test-cust-b', tenantId: 't-a1test-tenant-b', name: 'Cliente QA B', nif: '5000000002' } });
    }
  }, 30000);

  it('FT emissão produz hash V2 e cadeia íntegra', async () => {
    const tenantId = 't-a1test-tenant-a';
    const before = await prisma!.invoiceChainState.findUnique({ where: { tenantId } });
    const beforeSeq = before?.lastSequence ?? 0;

    const inv = await issueInvoice({
      customerName: 'Cliente QA A',
      customerNif: '5000000001',
      items: [{ productId: null, desc: 'Integração FT', qty: 1, rate: 100 }],
      applyVat: true,
      discountType: 'amount',
      discountValue: 0,
      observations: 'A1.1 integration FT',
      includeCompanyProfile: false,
      dueAt: null,
    }, tenantId);

    expect(inv.id).toBeTruthy();
    expect(inv.chainSequence).toBe(beforeSeq + 1);
    expect(inv.hashVersion).toBe(2);
    expect(inv.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(inv.number).toMatch(/^FT \d{4}\/\d{4}$/);

    const items = await prisma!.invoiceItem.findMany({
      where: { invoiceId: inv.id },
      orderBy: { position: 'asc' },
    });
    expect(items.length).toBe(1);
    expect(items[0].position).toBe(0);
  }, 30000);

  it('NC emissão mantém cadeia e marca original ANULADA', async () => {
    const tenantId = 't-a1test-tenant-a';
    const baseInvoice = await issueInvoice({
      customerName: 'Cliente QA A',
      customerNif: '5000000001',
      items: [{ productId: null, desc: 'NC source', qty: 1, rate: 200 }],
      applyVat: true,
      discountType: 'amount',
      discountValue: 0,
      observations: 'A1.1 integration NC-source',
      includeCompanyProfile: false,
      dueAt: null,
    }, tenantId);

    const originalSequence = baseInvoice.chainSequence ?? 0;
    const nc = await issueCreditNote({ invoiceId: baseInvoice.id, reason: 'Refund test — QA', tenantId });
    expect(nc.chainSequence).toBeGreaterThan(originalSequence);
    expect(nc.hashVersion).toBe(2);

    const anulada = await prisma!.invoice.findUnique({ where: { id: baseInvoice.id } });
    expect(anulada?.status).toBe('ANULADA');
  }, 30000);

  it('isolamento multi-tenant — dois tenants não compartilham cadeias', async () => {
    const invA = await issueInvoice({
      customerName: 'Cliente A T-A',
      customerNif: '5000000001',
      items: [{ productId: null, desc: 'Tenant A FT', qty: 1, rate: 50 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, 't-a1test-tenant-a');
    const invB = await issueInvoice({
      customerName: 'Cliente B T-B',
      customerNif: '5000000002',
      items: [{ productId: null, desc: 'Tenant B FT', qty: 1, rate: 50 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, 't-a1test-tenant-b');

    expect(invA.tenantId).toBe('t-a1test-tenant-a');
    expect(invB.tenantId).toBe('t-a1test-tenant-b');
    expect(invA.hash).not.toBe(invB.hash);
  }, 30000);
});
