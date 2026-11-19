import { spawnSync, spawn } from 'child_process';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { issueInvoice } from './invoice-service';
import fs from 'fs';
import path from 'path';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');

let prisma: any = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}

const describeIfDisposable = enabled ? describe : describe.skip;

const a17Dir = path.resolve(process.cwd(), '.qa-a17');
const bundledWorker = path.join(a17Dir, 'crash-worker.cjs');

function makeServerOnlyStub(): void {
  if (!fs.existsSync(a17Dir)) fs.mkdirSync(a17Dir, { recursive: true });
  fs.writeFileSync(path.join(a17Dir, 'server-only-stub.js'), 'module.exports = {};\n');
}

function makeWorkerBundle(): void {
  if (!fs.existsSync(a17Dir)) fs.mkdirSync(a17Dir, { recursive: true });
  const source = `import { issueInvoice } from '../src/lib/invoice-service';
async function main() {
  const tenantId = process.env.A17_TENANT_ID;
  if (!tenantId) { console.log(JSON.stringify({ status: 'error', message: 'tenant required' })); process.exit(2); }
  const productId = tenantId + '-p';
  console.log(JSON.stringify({ status: 'started', pid: process.pid, tenantId }));
  try {
    const r = await issueInvoice({
      customerName: 'A17 Worker', customerNif: '5000000001',
      items: [{ productId, desc: 'item', qty: 1, rate: 100 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }, tenantId);
    console.log(JSON.stringify({ status: 'released', invoiceId: r?.id }));
    process.exit(0);
  } catch (e) {
    console.log(JSON.stringify({ status: 'error', message: String(e?.message ?? e).slice(0, 200) }));
    process.exit(1);
  }
}
main();`;
  fs.writeFileSync(path.join(a17Dir, 'crash-worker.ts'), source);
  spawnSync('npx', ['esbuild', '.qa-a17/crash-worker.ts', '--bundle', '--platform=node', '--format=cjs', '--target=es2022', '--outfile=.qa-a17/crash-worker.cjs',
    '--external:@prisma/client', '--external:prisma', '--external:@prisma/adapter-pg', '--external:pg', '--external:bcryptjs', '--alias:server-only=./.qa-a17/server-only-stub.js'], { cwd: process.cwd() });
}

describeIfDisposable('A17 — SIGKILL crash recovery', () => {
  const suffix = Date.now().toString().slice(-6);
  const tenantId = `a17-sigkill-${suffix}`;

  const runWorker = (env: Record<string, string>): Promise<string> =>
    new Promise((resolve) => {
      const worker = spawn(process.execPath, [bundledWorker], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      worker.stdout?.on('data', (d: any) => { out += String(d); });
      worker.stderr?.on('data', (d: any) => { out += String(d); });
      worker.on('close', () => resolve(out));
    });

  beforeAll(async () => {
    if (!prisma) return;
    makeServerOnlyStub();
    makeWorkerBundle();
    await prisma.tenant.create({ data: { id: tenantId, name: `A17 SIGKILL ${suffix}`, plan: 'PRO', status: 'ACTIVE' } });
    await prisma.product.create({ data: { id: `${tenantId}-p`, tenantId, name: 'A17 item', price: 100, stock: 1000, trackStock: false } });
  }, 60_000);

  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  it('A. SIGKILL after lease acquisition: orphaned lease is recoverable', async () => {
    const crash = await runWorker({ A17_CRASH_AT: 'after_lease_acquire', A17_TENANT_ID: tenantId });
    expect(crash).not.toContain('released');

    const lease = await prisma.emissionLease.findFirst({ where: { tenantId, state: 'ACTIVE' } });
    expect(lease).toBeTruthy();

    const invoicesBefore = await prisma.invoice.count({ where: { tenantId } });
    expect(invoicesBefore).toBe(0);

    await prisma.emissionLease.updateMany({
      where: { tenantId, state: 'ACTIVE' },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const recovery = await runWorker({ A17_TENANT_ID: tenantId });
    expect(recovery).toContain('released');

    const invoicesAfter = await prisma.invoice.count({ where: { tenantId } });
    expect(invoicesAfter).toBe(1);
  }, 120_000);

  it('B. SIGKILL during transaction: rollback, no partial invoice, recovery works', async () => {
    const freshTenant = `${tenantId}-b`;
    await prisma.tenant.create({ data: { id: freshTenant, name: `A17 B ${suffix}`, plan: 'PRO', status: 'ACTIVE' } });
    await prisma.product.create({ data: { id: `${freshTenant}-p`, tenantId: freshTenant, name: 'A17 item', price: 100, stock: 1000, trackStock: false } });

    const crash = await runWorker({ A17_CRASH_AT: 'during_tx', A17_TENANT_ID: freshTenant });
    expect(crash).not.toContain('released');

    const invoices = await prisma.invoice.count({ where: { tenantId: freshTenant } });
    expect(invoices).toBe(0);

    const orphan = await prisma.emissionLease.findFirst({ where: { tenantId: freshTenant, state: 'ACTIVE' } });
    expect(orphan).toBeTruthy();

    await prisma.emissionLease.updateMany({
      where: { tenantId: freshTenant, state: 'ACTIVE' },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const recovery = await runWorker({ A17_TENANT_ID: freshTenant });
    expect(recovery).toContain('released');
    const after = await prisma.invoice.count({ where: { tenantId: freshTenant } });
    expect(after).toBe(1);
  }, 120_000);

  it('D. SIGKILL after commit, before lease release: FT preserved, lease recovered by TTL', async () => {
    const freshTenant = `${tenantId}-d`;
    await prisma.tenant.create({ data: { id: freshTenant, name: `A17 D ${suffix}`, plan: 'PRO', status: 'ACTIVE' } });
    await prisma.product.create({ data: { id: `${freshTenant}-p`, tenantId: freshTenant, name: 'A17 item', price: 100, stock: 1000, trackStock: false } });

    const crash = await runWorker({ A17_CRASH_AT: 'before_release', A17_TENANT_ID: freshTenant });
    expect(crash).not.toContain('released');

    const invoices = await prisma.invoice.count({ where: { tenantId: freshTenant } });
    expect(invoices).toBe(1);

    const orphan = await prisma.emissionLease.findFirst({ where: { tenantId: freshTenant, state: 'ACTIVE' } });
    expect(orphan).toBeTruthy();

    await prisma.emissionLease.updateMany({
      where: { tenantId: freshTenant, state: 'ACTIVE' },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const recovery = await runWorker({ A17_TENANT_ID: freshTenant });
    expect(recovery).toContain('released');
    const after = await prisma.invoice.count({ where: { tenantId: freshTenant } });
    expect(after).toBe(2);
  }, 120_000);

  it('C/E. Idempotency: same key reissued yields one invoice (in-process)', async () => {
    const key = `a17-idem-${suffix}`;
    const base = {
      customerName: 'Idem', customerNif: '5000000001',
      items: [{ productId: `${tenantId}-p`, desc: 'item', qty: 1, rate: 100 }],
      applyVat: true, discountType: 'amount' as const, discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    };
    const r1 = await issueInvoice(base, tenantId, undefined, key);
    const r2 = await issueInvoice(base, tenantId, undefined, key);
    expect(r1?.id).toBeTruthy();
    expect(r2?.id).toBe(r1?.id);
    const idemRow = await prisma.idempotentRequest.findFirst({ where: { tenantId, key, resource: 'INVOICE' } });
    expect(idemRow).toBeTruthy();
    if (idemRow?.resultId) {
      const original = await prisma.invoice.findUnique({ where: { id: idemRow.resultId } });
      expect(original).toBeTruthy();
    }
  }, 60_000);
});
