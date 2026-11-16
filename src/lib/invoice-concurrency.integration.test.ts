/**
 * Testes de integração de concorrência da emissão fiscal, contra PostgreSQL real.
 *
 * Esta suite assume uma base descartável, nunca produção/staging.
 *
 * Uso:
 *   DATABASE_URL_A1=… npx vitest run src/lib/invoice-concurrency.integration.test.ts
 *
 * Cada caso gera IDs únicos de tenant para evitar dependência de estado residual.
 */

import { describe, it, expect } from 'vitest';
import { issueInvoice, issueCreditNote } from './invoice-service';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL_A1 || process.env.DATABASE_URL;
if (!url) throw new Error('Defina DATABASE_URL_A1 com o caminho de uma base descartável');
if (url.includes('supabase.com') || url.includes('pooler.supabase.com')) {
  throw new Error('DATABASE_URL_A1 aponta para Supabase — proibido nesta suite');
}

const prisma = new PrismaClient({
  datasources: { db: { url } },
  transactionOptions: { maxWait: 30_000, timeout: 90_000 },
});

const runId = () => `t-a1-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function seedFreshTenant() {
  const id = runId();
  await prisma.tenant.create({ data: { id, name: `QA ${id}`, plan: 'PRO', status: 'ACTIVE' } });
  await prisma.customer.create({ data: { id: `${id}-c`, tenantId: id, name: 'QA Customer', nif: '5000000001' } });
  return { tenantId: id, customerId: `${id}-c` };
}

describe('A1 — concorrência de emissão fiscal (real PostgreSQL)', () => {
  const FT_LOAD = 100;
  const MIX_LOAD = 50;

  it('100 FT concorrentes — sem duplicados nem quebra da cadeia', async () => {
    const { tenantId } = await seedFreshTenant();
    const before = await prisma.invoiceChainState.findUnique({ where: { tenantId } });
    const startingSeq = before?.lastSequence ?? 0;

    const numbers: string[] = [];
    const hashes: string[] = [];
    const sequences: number[] = [];
    const errors: Error[] = [];
    const start = Date.now();

    const promises: Promise<void>[] = [];
    for (let i = 0; i < FT_LOAD; i++) {
      promises.push(issueInvoice({
        customerName: 'Conc A', customerNif: '5000000001',
        items: [{ productId: null, desc: `LI-${i}`, qty: 1, rate: 100 + i }],
        applyVat: true, discountType: 'amount', discountValue: 0,
        observations: `concurrent-${i}`, includeCompanyProfile: false, dueAt: null,
      }, tenantId).then(r => {
        numbers.push(r.number!); hashes.push(r.hash!); sequences.push(r.chainSequence!);
      }).catch(e => { errors.push(e); }));
    }
    await Promise.all(promises);

    const elapsed = Date.now() - start;
    console.log(`concurrency: ${promises.length} in ${elapsed}ms successful: ${numbers.length} errors: ${errors.length}`);

    expect(errors.length).toBe(0);
    expect(new Set(numbers).size).toBe(FT_LOAD);
    expect(new Set(hashes).size).toBe(FT_LOAD);
    expect(new Set(sequences).size).toBe(FT_LOAD);

    const sorted = [...sequences].sort((a, b) => a - b);
    expect(sorted[sorted.length - 1] - startingSeq).toBe(FT_LOAD);

    const chain = await prisma.invoiceChainState.findUnique({ where: { tenantId } });
    expect(chain?.lastSequence).toBe(startingSeq + FT_LOAD);
  }, 90000);

  it('50 FT + 50 NC concorrentes — cadeia preservada', async () => {
    const { tenantId } = await seedFreshTenant();

    const baseSeed: any[] = [];
    for (let i = 0; i < MIX_LOAD; i++) {
      baseSeed.push(await issueInvoice({
        customerName: 'Mix Base', customerNif: '5000000001',
        items: [{ productId: null, desc: `seed-${i}`, qty: 1, rate: 50 + i }],
        applyVat: true, discountType: 'amount', discountValue: 0,
        observations: null, includeCompanyProfile: false, dueAt: null,
      }, tenantId));
    }
    const before = await prisma.invoiceChainState.findUnique({ where: { tenantId } });
    const startingSeq = before?.lastSequence ?? 0;

    const ops: Promise<any>[] = [];
    for (let i = 0; i < MIX_LOAD; i++) {
      ops.push(issueInvoice({
        customerName: 'Mix FT', customerNif: '5000000001',
        items: [{ productId: null, desc: `mix-ft-${i}`, qty: 1, rate: 25 }],
        applyVat: true, discountType: 'amount', discountValue: 0,
        observations: null, includeCompanyProfile: false, dueAt: null,
      }, tenantId).then(r => ({ kind: 'FT', r })));
      ops.push(issueCreditNote({ invoiceId: baseSeed[i].id, reason: `nc-${i}`, tenantId })
        .then(r => ({ kind: 'NC', r })));
    }

    const results = await Promise.all(ops);
    console.log(`mixed: ${results.length} ok FT=${results.filter(r => r.kind === 'FT').length} NC=${results.filter(r => r.kind === 'NC').length}`);

    expect(results.length).toBe(ops.length);
    for (const r of results) expect(r.r).toBeTruthy();

    const chain = await prisma.invoiceChainState.findUnique({ where: { tenantId } });
    expect(chain?.lastSequence).toBe(startingSeq + 2 * MIX_LOAD);
  }, 90000);

  it('multi-tenant: tenants distintos não partilham cadeia', async () => {
    const a = await seedFreshTenant();
    const b = await seedFreshTenant();

    const fta = await issueInvoice({
      customerName: 'Tenant A FT', customerNif: '5000000001',
      items: [{ productId: null, desc: 'iso-a', qty: 1, rate: 100 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, a.tenantId);

    const ftb = await issueInvoice({
      customerName: 'Tenant B FT', customerNif: '5000000002',
      items: [{ productId: null, desc: 'iso-b', qty: 1, rate: 200 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, b.tenantId);

    expect(fta.tenantId).toBe(a.tenantId);
    expect(ftb.tenantId).toBe(b.tenantId);
    expect(fta.hash).not.toBe(ftb.hash);
  }, 60000);
});
